import { createController } from 'remix/router'
import { css } from 'remix/ui'
import { Auth } from 'remix/middleware/auth'
import { requireAdmin } from '../../middleware/admin.ts'
import { mastra } from '../mastra/index.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { sseEncoder, sseHeaders, sseErrorResponse, sseEvent, pipeStream } from '../../utils/agent-sse.ts'
import { Layout } from '../../ui/layout.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { RouteAgentPage } from '../../ui/route-agent-page.tsx'
import { routes } from '../../routes.ts'

const MAX_MESSAGE_LENGTH = 5000

const routeAgentRateLimiter = createRateLimiter({ windowMs: 10_000, perKey: true, maxAttempts: 5 })

function getTarget(path: string): string {
  let prefixes: [string, string][] = [
    ['/admin', 'admin-content'],
    ['/mastra', 'admin-content'],
    ['/verwaltung', 'admin-content'],
    ['/lists', 'lists-content'],
  ]
  let match: [string, string] | undefined
  for (let [prefix, target] of prefixes) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      if (!match || prefix.length > match[0].length) match = [prefix, target]
    }
  }
  return match?.[1] ?? 'lists-content'
}

export const routeAgent = createController(
  routes.routeAgent,
  {
    middleware: [requireAdmin()],

    actions: {
      async index(context) {
        return context.render(
          <Layout title="Route Agent">
            <RouteAgentPage />
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
            Ask the agent to navigate somewhere, e.g. "show me the lists"
          </div>,
        )
      },

      async action(context) {
        let rawIp = context.request.headers.get('X-Forwarded-For') || ''
        let ip = rawIp.split(',')[0].trim() || 'anon'
        if (!routeAgentRateLimiter.attempt(ip)) {
          return sseErrorResponse('Too many requests', 429)
        }

        let rawMessage = context.formData.get('message')?.toString() ?? ''
        if (rawMessage.length > MAX_MESSAGE_LENGTH) {
          return sseErrorResponse(`Message too long (max ${MAX_MESSAGE_LENGTH})`, 400)
        }
        let message = rawMessage.trim()
        if (!message) {
          return sseErrorResponse('Message is required', 400)
        }

        let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent = mastra.getAgent('routeAgent')
              let output = await agent.stream(message, {
                memory: { thread: threadId, resource: 'route-user' },
              })
              controller.enqueue(sseEvent('start', { runId: output.runId, threadId }))
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
              )
            } catch (err) {
              console.error('[routeAgent] action error:', err)
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
        let rawIp = context.request.headers.get('X-Forwarded-For') || ''
        let ip = rawIp.split(',')[0].trim() || 'anon'
        if (!routeAgentRateLimiter.attempt(ip)) {
          return sseErrorResponse('Too many requests', 429)
        }

        let runId = context.formData.get('runId')?.toString()
        let answerRaw = context.formData.get('answer')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let selectionMode = context.formData.get('selectionMode')?.toString()

        if (!runId || !answerRaw) {
          return sseErrorResponse('Missing runId or answer', 400)
        }

        if (answerRaw.length > MAX_MESSAGE_LENGTH) {
          return sseErrorResponse(`Answer too long (max ${MAX_MESSAGE_LENGTH})`, 400)
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
              let agent = mastra.getAgent('routeAgent')
              let output = await agent.resumeStream(resumeData, { runId, toolCallId })
              controller.enqueue(sseEvent('start', { runId: output.runId, threadId: context.formData.get('threadId')?.toString() }))
              await pipeStream(
                output.fullStream as unknown as ReadableStream,
                controller,
                context.request.signal,
                output.runId,
                getTarget,
              )
            } catch (err) {
              console.error('[routeAgent] answer error:', err)
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
        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let decision = context.formData.get('decision')?.toString()

        if (!runId) {
          return sseErrorResponse('Missing runId', 400)
        }

        if (decision !== 'approve' && decision !== 'decline') {
          return sseErrorResponse('decision must be "approve" or "decline"', 400)
        }

        try {
          let agent = mastra.getAgent('routeAgent')
          let result = (await (decision === 'approve'
            ? agent.approveToolCallGenerate({ runId, toolCallId })
            : agent.declineToolCallGenerate({ runId, toolCallId }))) as {
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
                  c.enqueue(sseEvent('question', {
                    runId: result.runId || runId,
                    toolCallId: sp?.toolCallId,
                    question: sp.question,
                    options: sp.options ?? null,
                    selectionMode: sp.selectionMode ?? 'single_select',
                  }))
                  c.enqueue(sseEvent('complete', {}))
                  c.close()
                },
              })
              return new Response(body2, { headers: sseHeaders() })
            }
            if (sp?.toolCallId || sp?.toolName) {
              let body2 = new ReadableStream({
                start: (c) => {
                  c.enqueue(sseEvent('suspension', {
                    runId: result.runId || runId,
                    toolCallId: sp.toolCallId,
                    toolName: sp.toolName,
                    args: sp.args,
                  }))
                  c.enqueue(sseEvent('complete', {}))
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
              if (text) c.enqueue(sseEvent('message', { text }))
              c.enqueue(sseEvent('complete', {}))
              c.close()
            },
          })
          return new Response(body4, { headers: sseHeaders() })
        } catch (err) {
          console.error(`[routeAgent] toolDecision (${decision}) error:`, err)
          return sseErrorResponse('Failed to process tool decision', 500)
        }
      },
    },
  },
)
