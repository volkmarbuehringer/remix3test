import { createController } from 'remix/router'
import { Logger } from 'remix/middleware/logger'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes } from '../../routes.ts'
import { mastra } from './index.ts'
import { getCurrentUser, getAdminIdentity } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { sseEncoder, sseHeaders, pipeStream } from '../../utils/agent-sse.ts'
import { runWithAdminId } from './tools/admin-context.ts'
import {
  MAX_MESSAGE_LENGTH,
  AGENT_TIMEOUT_MS,
  sanitizeLog,
  validateMessage,
} from './shared-agent.ts'

import { logAdminAction } from '../../data/audit-log.ts'
import { css } from 'remix/ui'
import { Layout } from '../../ui/layout.tsx'
import { MastraChatPage } from '../../ui/admin-mastra-chat-page.tsx'
import { SupportAgentPage } from '../../ui/support-agent-page.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import type { AppContext } from '../../types/context.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import type { TestAgent } from './shared-agent.ts'

const chatRateLimiter = createRateLimiter({ windowMs: 2000, perUser: true })

export { chatRateLimiter }

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

export const mastraChat = createController<typeof routes.mastra.chat, AppContext>(
  routes.mastra.chat,
  {
    middleware: [requireAuth(), requireAdmin()],
    actions: {
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
            Frage zu Benutzern, Terminen und Systemdaten...
          </div>,
        )
      },

      async index(context) {
        let threadId = context.url.searchParams.get('threadId') ?? undefined
        if (threadId && !validateThreadId(threadId)) threadId = undefined
        let error = context.url.searchParams.get('error') ?? undefined
        let isFrameRequest = context.request.headers.has('X-Remix-Target')
        if (isFrameRequest) {
          let chatMessages: ChatMessage[] = []
          if (threadId) {
            try {
              let agent = mastra.getAgent('supportAgent')
              chatMessages = await recallChatMessages(agent, threadId)
            } catch (error) {
              if (process.env.NODE_ENV !== 'test') {
                console.error('[MastraChat] recall failed for ' + threadId + ': ' + String(error))
              }
            }
          }
          return context.render(
            <div
              mix={css({
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: theme.surface.lvl0,
              })}
            >
              <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
            </div>,
          )
        }
        return context.render(
          <Layout title="Support-Agent">
            <SupportAgentPage />
          </Layout>,
        )
      },

      async action(context) {
        let user = getCurrentUser()
        let log = (...args: unknown[]) =>
          context.get(Logger)?.(
            `[MastraChat] [user:${user.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          )

        log('POST action start')

        let validation = validateMessage(context.formData)
        if (!validation.ok) {
          log('validation failed: ' + validation.error)
          let errorMsg: string
          if (validation.error === 'too_long') {
            errorMsg = `Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`
          } else if (validation.error === 'bad_thread_id') {
            errorMsg = 'Ungültiges Thread-ID-Format.'
          } else {
            errorMsg = 'Bitte gib eine Nachricht ein.'
          }
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        let message = validation.message
        let threadId = validation.threadId

        if (!chatRateLimiter.attempt(user.id)) {
          log('rate limited')
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.' })}\n\n`,
            ),
            { status: 429, headers: sseHeaders() },
          )
        }

        if (!threadId) {
          threadId = crypto.randomUUID()
          log('new mastra thread created: ' + sanitizeLog(threadId))
        } else {
          log('continuing thread: ' + sanitizeLog(threadId))
        }

        let body = new ReadableStream({
          start: async (controller) => {
            let agent: TestAgent =
              process.env.NODE_ENV === 'test' && _testAgent
                ? _testAgent
                : mastra.getAgent('supportAgent')

            let abortController = new AbortController()
            let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

            try {
              log('calling agent.stream')
              let output = await runWithAdminId(user.id, () =>
                agent.stream(message, {
                  maxSteps: 10,
                  abortSignal: abortController.signal,
                  memory: {
                    thread: threadId!,
                    resource: String(user.id),
                  },
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
                abortController.signal,
                output.runId,
              )

              clearTimeout(timeout)

              let authIdentity = getAdminIdentity(context.auth)
              if (authIdentity) {
                logAdminAction(context.db, {
                  admin_user_id: authIdentity.id,
                  admin_email: authIdentity.email,
                  action_type: 'support_message',
                  target_type: 'mastra_thread',
                  target_id: threadId,
                })
              }

              log('stream completed')
            } catch (err) {
              clearTimeout(timeout)
              let msg = sanitizeLog(err instanceof Error ? err.message : String(err))
              log('error: ' + msg)
              try {
                controller.enqueue(
                  sseEncoder.encode(
                    `event: agent-error\ndata: ${JSON.stringify({ error: msg })}\n\n`,
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
        let log = (...args: unknown[]) =>
          context.get(Logger)?.(
            `[MastraChat] [toolDecision] [user:${user.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          )

        if (!chatRateLimiter.attempt(user.id)) {
          log('rate limited')
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Bitte warte einen Moment.' })}\n\n`,
            ),
            { status: 429, headers: sseHeaders() },
          )
        }

        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let decision = context.formData.get('decision')?.toString()
        let threadId = context.formData.get('threadId')?.toString()

        if (!runId) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Fehlende runId' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (decision !== 'approve' && decision !== 'decline') {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'decision muss "approve" oder "decline" sein' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        log('tool decision: ' + decision + ' runId: ' + sanitizeLog(runId))

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              controller.enqueue(
                sseEncoder.encode(`event: start\ndata: ${JSON.stringify({ runId, threadId })}\n\n`),
              )

              let agent = mastra.getAgent('supportAgent')
              let result = (await runWithAdminId(user.id, () =>
                decision === 'approve'
                  ? agent.approveToolCallGenerate({ runId, toolCallId })
                  : agent.declineToolCallGenerate({ runId, toolCallId }),
              )) as {
                text?: string
                finishReason?: string
                runId?: string
                suspendPayload?: Record<string, unknown>
                fullStream?: unknown
              }

              let authIdentity = getAdminIdentity(context.auth)
              if (authIdentity) {
                logAdminAction(context.db, {
                  admin_user_id: authIdentity.id,
                  admin_email: authIdentity.email,
                  action_type: 'support_tool_approval',
                  target_type: 'mastra_tool_call',
                  target_id: runId,
                })
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
                  controller.enqueue(
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
                  controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
                  controller.close()
                  return
                }
                if (sp?.toolCallId || sp?.toolName) {
                  controller.enqueue(
                    sseEncoder.encode(
                      `event: suspension\ndata: ${JSON.stringify({
                        runId: result.runId || runId,
                        toolCallId: sp.toolCallId,
                        toolName: sp.toolName,
                        args: sp.args,
                      })}\n\n`,
                    ),
                  )
                  controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
                  controller.close()
                  return
                }
              }

              if (result.fullStream) {
                await pipeStream(
                  result.fullStream as unknown as ReadableStream,
                  controller,
                  context.request.signal,
                )
                return
              }

              let text = (
                result.text || (decision === 'approve' ? '' : 'Die Aktion wurde abgelehnt.')
              ).trim()
              if (text) {
                controller.enqueue(
                  sseEncoder.encode(`event: message\ndata: ${JSON.stringify({ text })}\n\n`),
                )
              }
              controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
              controller.close()
            } catch (err) {
              log('error: ' + sanitizeLog(err instanceof Error ? err.message : String(err)))
              try {
                controller.enqueue(
                  sseEncoder.encode(
                    `event: agent-error\ndata: ${JSON.stringify({ error: 'Fehler bei der Verarbeitung der Entscheidung.' })}\n\n`,
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
        let log = (...args: unknown[]) =>
          context.get(Logger)?.(
            `[MastraChat] [answer] [user:${user.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          )

        if (!chatRateLimiter.attempt(user.id)) {
          log('rate limited')
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Bitte warte einen Moment.' })}\n\n`,
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
              `event: agent-error\ndata: ${JSON.stringify({ error: 'Fehlende runId oder Antwort' })}\n\n`,
            ),
            { status: 400, headers: sseHeaders() },
          )
        }

        if (answerRaw.length > MAX_MESSAGE_LENGTH) {
          return new Response(
            sseEncoder.encode(
              `event: agent-error\ndata: ${JSON.stringify({ error: `Antwort zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen)` })}\n\n`,
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

        log('resuming stream: ' + sanitizeLog(runId))

        let body = new ReadableStream({
          start: async (controller) => {
            try {
              let agent = mastra.getAgent('supportAgent')
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
              )
              try {
                controller.enqueue(sseEncoder.encode(`event: complete\ndata: {}\n\n`))
              } catch {
                /* already closed/sent */
              }
            } catch (err) {
              log('error: ' + sanitizeLog(err instanceof Error ? err.message : String(err)))
              try {
                controller.enqueue(
                  sseEncoder.encode(
                    `event: agent-error\ndata: ${JSON.stringify({ error: 'Fehler beim Fortsetzen des Agents.' })}\n\n`,
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
    },
  },
)
