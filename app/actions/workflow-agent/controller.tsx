import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { sseEncoder, sseHeaders, pipeStream } from '../../utils/agent-sse.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { WorkflowAgentPage } from '../../ui/workflow-agent-page.tsx'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { runWithAdminId } from '../mastra/tools/admin-context.ts'
import { AGENT_TIMEOUT_MS } from '../mastra/shared-agent.ts'
import type { AppContext } from '../../types/context.ts'
import type { TestAgent } from '../mastra/shared-agent.ts'

const MAX_MESSAGE_LENGTH = 5000

// Test-only agent injection point — setter is a no-op outside test env
let _testAgent: TestAgent | undefined
export function __setTestAgent(agent: typeof _testAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}
export function __getTestAgent() {
  return _testAgent
}

// Keyed on the authenticated admin's user id — never on client-supplied
// headers like X-Forwarded-For, which are spoofable (see remix3-two-tier-ip-trust-model).
// Exported so tests can reset state between cases.
export const workflowAgentRateLimiter = createRateLimiter({
  windowMs: 10_000,
  perUser: true,
  maxAttempts: 5,
})

function getTarget(path: string): string {
  let prefixes: [string, string][] = [
    ['/admin', 'admin-content'],
    ['/mastra', 'admin-content'],
    ['/verwaltung', 'admin-content'],
    ['/workflow-agent', 'admin-content'],
    ['/lists', 'lists-content'],
  ]
  let match: [string, string] | undefined
  for (let [prefix, target] of prefixes) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      if (!match || prefix.length > match[0].length) match = [prefix, target]
    }
  }
  return match?.[1] ?? 'admin-content'
}

export const workflowAgent = createController<typeof routes.workflowAgent, AppContext>(
  routes.workflowAgent,
  {
    middleware: [requireAdmin()],

    actions: {
      async index(context) {
        return context.render(
          <Layout title="Workflow-Agent">
            <WorkflowAgentPage />
          </Layout>,
        )
      },

      async panel(context) {
        return context.render(
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.text.muted,
              fontSize: '1rem',
            })}
          >
            Ask the agent to manage a user account...
          </div>,
        )
      },

      async action(context) {
        let user = getCurrentUser()
        if (!workflowAgentRateLimiter.attempt(user.id)) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`,
            ),
            { status: 429, headers: sseHeaders() },
          )
        }

        let rawMessage = context.formData.get('message')?.toString() ?? ''
        if (rawMessage.length > MAX_MESSAGE_LENGTH) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: `Message too long (max ${MAX_MESSAGE_LENGTH})` })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }
        let message = rawMessage.trim()
        if (!message) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent: TestAgent =
                process.env.NODE_ENV === 'test' && _testAgent
                  ? _testAgent
                  : mastra.getAgent('workflowAgent')
              let output = await runWithAdminId(user.id, () =>
                agent.stream(message, {
                  maxSteps: 10,
                  abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
                  memory: { thread: threadId, resource: String(user.id) },
                }),
              )
              controller.enqueue(
                sseEncoder.encode(
                  `event: start\ndata: ${JSON.stringify({ runId: output.runId, threadId })}\n\n`,
                ),
              )
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
              )
            } catch (err) {
              console.error('[workflowAgent] action error:', err)
              try {
                controller.enqueue(
                  sseEncoder.encode(
                    `event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to process request' })}\n\n`,
                  ),
                )
              } catch {
                /* controller already errored */
              }
              try {
                controller.close()
              } catch {
                /* already closed */
              }
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async answer(context) {
        let user = getCurrentUser()
        if (!workflowAgentRateLimiter.attempt(user.id)) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`,
            ),
            { status: 429, headers: sseHeaders() },
          )
        }

        let runId = context.formData.get('runId')?.toString()
        let answerRaw = context.formData.get('answer')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let selectionMode = context.formData.get('selectionMode')?.toString()

        if (!runId || !answerRaw) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Missing runId or answer' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (answerRaw.length > MAX_MESSAGE_LENGTH) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: `Answer too long (max ${MAX_MESSAGE_LENGTH})` })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        let resumeData: unknown = answerRaw
        if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
          try {
            resumeData = JSON.parse(answerRaw)
          } catch {
            /* keep as string */
          }
        }

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent: TestAgent =
                process.env.NODE_ENV === 'test' && _testAgent
                  ? _testAgent
                  : mastra.getAgent('workflowAgent')
              let output = await runWithAdminId(user.id, () =>
                agent.resumeStream(resumeData, { runId, toolCallId }),
              )
              controller.enqueue(
                sseEncoder.encode(
                  `event: start\ndata: ${JSON.stringify({ runId: output.runId, threadId: context.formData.get('threadId')?.toString() })}\n\n`,
                ),
              )
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
              )
            } catch (err) {
              console.error('[workflowAgent] answer error:', err)
              try {
                controller.enqueue(
                  sseEncoder.encode(
                    `event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to resume agent' })}\n\n`,
                  ),
                )
              } catch {
                /* controller already errored */
              }
              try {
                controller.close()
              } catch {
                /* already closed */
              }
            }
          },
        })

        return new Response(body, { headers: sseHeaders() })
      },

      async toolDecision(context) {
        let user = getCurrentUser()
        if (!workflowAgentRateLimiter.attempt(user.id)) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`,
            ),
            { status: 429, headers: sseHeaders() },
          )
        }

        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let decision = context.formData.get('decision')?.toString()

        if (!runId) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Missing runId' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (decision !== 'approve' && decision !== 'decline') {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'decision must be "approve" or "decline"' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        try {
          let agent: TestAgent =
            process.env.NODE_ENV === 'test' && _testAgent
              ? _testAgent
              : mastra.getAgent('workflowAgent')
          let result = (await runWithAdminId(user.id, () =>
            decision === 'approve'
              ? agent.approveToolCallGenerate!({ runId, toolCallId })
              : agent.declineToolCallGenerate!({ runId, toolCallId }),
          )) as {
            text?: string
            finishReason?: string
            runId?: string
            suspendPayload?: Record<string, unknown>
            fullStream?: ReadableStream
          }

          if (result.finishReason === 'suspended') {
            let sp = result.suspendPayload as
              | {
                  question?: string
                  options?: { label: string; description?: string }[]
                  selectionMode?: string
                  toolCallId?: string
                  toolName?: string
                  args?: Record<string, unknown>
                }
              | undefined
            if (sp?.question) {
              let body2 = new ReadableStream({
                start: (c) => {
                  c.enqueue(
                    sseEncoder.encode(
                      `event: question\ndata: ${JSON.stringify({
                        runId: result.runId || runId,
                        toolCallId: sp?.toolCallId,
                        question: sp.question,
                        options: sp.options ?? null,
                        selectionMode: sp.selectionMode ?? 'single_select',
                      })}\n\n`,
                    ),
                  )
                  c.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
                  c.close()
                },
              })
              return new Response(body2, { headers: sseHeaders() })
            }
            if (sp?.toolCallId || sp?.toolName) {
              let body2 = new ReadableStream({
                start: (c) => {
                  c.enqueue(
                    sseEncoder.encode(
                      `event: suspension\ndata: ${JSON.stringify({
                        runId: result.runId || runId,
                        toolCallId: sp.toolCallId,
                        toolName: sp.toolName,
                        args: sp.args,
                      })}\n\n`,
                    ),
                  )
                  c.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
                  c.close()
                },
              })
              return new Response(body2, { headers: sseHeaders() })
            }
          }

          if (result.fullStream) {
            let body3 = new ReadableStream({
              start: async (controller) => {
                await pipeStream(
                  result.fullStream!,
                  controller,
                  context.request.signal,
                  undefined,
                  getTarget,
                )
              },
            })
            return new Response(body3, { headers: sseHeaders() })
          }

          let text = (
            result.text || (decision === 'approve' ? '' : 'The action was declined.')
          ).trim()
          let body4 = new ReadableStream({
            start: (c) => {
              if (text) {
                c.enqueue(
                  sseEncoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`),
                )
              }
              c.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
              c.close()
            },
          })
          return new Response(body4, { headers: sseHeaders() })
        } catch (err) {
          console.error(`[workflowAgent] toolDecision (${decision}) error:`, err)
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to process tool decision' })}\n\n`,
            ),
            { status: 500, headers: sseHeaders() },
          )
        }
      },
    },
  },
)
