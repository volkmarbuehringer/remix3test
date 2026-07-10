import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Logger } from 'remix/middleware/logger'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes, frames } from '../../routes.ts'
import { mastra } from './index.ts'
import { getCurrentUser, getAdminIdentity } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { runWithAdminId } from './tools/admin-context.ts'
import {
  MAX_MESSAGE_LENGTH,
  AGENT_TIMEOUT_MS,
  wantsJson,
  sanitizeLog,
  isAbortError,
  callAgentWithTimeout,
  validateMessage,
} from './shared-agent.ts'

import { logAdminAction } from '../../data/audit-log.ts'
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { Layout } from '../../ui/layout.tsx'
import { MastraChatPage } from '../../ui/admin-mastra-chat-page.tsx'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import type { AppContext } from '../../types/context.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import type { TestAgent } from './shared-agent.ts'

const CHAT_INDEX = routes.mastra.chat.index.href()

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
      async index(context) {
        let threadId = context.url.searchParams.get('threadId') ?? undefined
        if (threadId && !validateThreadId(threadId)) threadId = undefined
        let error = context.url.searchParams.get('error') ?? undefined
        let pending = context.url.searchParams.get('pending') === 'true'
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
        let approvalData:
          | { runId?: string; toolCallId?: string; threadId?: string; responseText?: string }
          | undefined
        let session = context.session
        if (session) {
          approvalData = session.get('toolApproval') as typeof approvalData | undefined
        }
        let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
        if (isFrameRequest) {
          return renderAdminPage(
            context.render,
            'support',
            <MastraChatPage
              messages={chatMessages}
              threadId={threadId}
              error={error}
              pending={pending}
              approvalData={approvalData}
            />,
          )
        }
        return context.render(
          <Layout>
            <AdminLayout activeItem="support">
              <MastraChatPage
                messages={chatMessages}
                threadId={threadId}
                error={error}
                pending={pending}
                approvalData={approvalData}
              />
            </AdminLayout>
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
          if (wantsJson(context.request.headers)) {
            let jsonMsg: string
            if (validation.error === 'too_long') {
              jsonMsg = `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`
            } else if (validation.error === 'bad_thread_id') {
              jsonMsg = 'Invalid thread ID format'
            } else {
              jsonMsg = 'Please enter a message'
            }
            return context.json({ error: jsonMsg }, { status: 400 })
          }
          let errorMsg: string
          if (validation.error === 'too_long') {
            errorMsg = `Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`
          } else if (validation.error === 'bad_thread_id') {
            errorMsg = 'Ungültiges Thread-ID-Format.'
          } else {
            errorMsg = 'Bitte gib eine Nachricht ein.'
          }
          return redirect(CHAT_INDEX + '?error=' + encodeURIComponent(errorMsg))
        }

        let message = validation.message
        let threadId = validation.threadId

        if (!chatRateLimiter.attempt(user.id)) {
          log('rate limited')
          if (wantsJson(context.request.headers)) {
            return context.json(
              { error: 'Please wait before sending another message' },
              { status: 429 },
            )
          }
          return redirect(
            CHAT_INDEX +
              '?error=' +
              encodeURIComponent(
                'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.',
              ),
          )
        }

        if (!threadId) {
          threadId = crypto.randomUUID()
          log('new mastra thread created: ' + sanitizeLog(threadId))
        } else {
          log('continuing thread: ' + sanitizeLog(threadId))
        }

        try {
          log('calling agent.generate')
          let agent: TestAgent | typeof _testAgent =
            process.env.NODE_ENV === 'test' && _testAgent
              ? _testAgent
              : mastra.getAgent('supportAgent')

          let result = await runWithAdminId(user.id, () =>
            callAgentWithTimeout({
              agent,
              message,
              threadId: threadId!,
              userId: user.id,
              maxSteps: 10,
              timeoutMs: AGENT_TIMEOUT_MS,
            }),
          )

          if (result.finishReason === 'suspended') {
            log('tool call suspended')
            let suspendPayload = result.suspendPayload as { toolCallId?: string } | undefined
            let toolCallId = suspendPayload?.toolCallId
            let session = context.session
            if (session) {
              session.flash('toolApproval', {
                runId: result.runId,
                toolCallId,
                threadId,
                responseText: result.text,
              })
            }
            if (wantsJson(context.request.headers)) {
              return context.json({
                requiresApproval: true,
                message: result.text,
                threadId,
              })
            }
            return redirect(
              CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '&pending=true#chat-end',
            )
          }

          let responseText = result.text
          if (!responseText.trim()) {
            log('agent returned empty response')
            if (wantsJson(context.request.headers)) {
              return context.json(
                { error: 'No response from assistant. Please try again.' },
                { status: 500 },
              )
            }
            return redirect(
              CHAT_INDEX +
                '?error=' +
                encodeURIComponent('Keine Antwort erhalten. Bitte versuche es erneut.'),
            )
          }

          let capturedToolCalls = result.toolCalls
          log('tool calls captured: ' + capturedToolCalls.length)

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

          log('success, response length: ' + responseText.length)
          if (wantsJson(context.request.headers)) {
            return context.json({ response: responseText, threadId })
          }
          let url = CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '#chat-end'
          return redirect(url)
        } catch (error) {
          log('error: ' + sanitizeLog(error instanceof Error ? error.message : String(error)))
          if (isAbortError(error)) {
            if (wantsJson(context.request.headers)) {
              return context.json(
                { error: 'Request timed out. Please try again.' },
                { status: 504 },
              )
            }
            return redirect(
              CHAT_INDEX +
                '?error=' +
                encodeURIComponent('Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.'),
            )
          }
          if (wantsJson(context.request.headers)) {
            return context.json(
              { error: 'An error occurred while processing your message.' },
              { status: 500 },
            )
          }
          return redirect(
            CHAT_INDEX +
              '?error=' +
              encodeURIComponent(
                'Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuche es erneut.',
              ),
          )
        }
      },
      async approve(context) {
        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let threadId = context.formData.get('threadId')?.toString()
        if (!runId || !threadId) {
          return redirect(CHAT_INDEX + '?error=' + encodeURIComponent('Ungültige Anfrage.'))
        }

        let user = getCurrentUser()
        let log = (...args: unknown[]) =>
          context.get(Logger)?.(
            `[MastraChat] [approve] [user:${user.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          )

        log('approving tool call: ' + sanitizeLog(runId))

        try {
          let agent = mastra.getAgent('supportAgent')
          let result = (await runWithAdminId(user.id, () =>
            agent.approveToolCallGenerate({ runId, toolCallId }),
          )) as {
            finishReason?: string
            suspendPayload?: { toolCallId?: string }
            text?: string
            runId?: string
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
            let sp = result.suspendPayload as { toolCallId?: string } | undefined
            let session = context.session
            if (session) {
              session.flash('toolApproval', {
                runId: result.runId,
                toolCallId: sp?.toolCallId,
                threadId,
                responseText: result.text,
              })
            }
            log('approval caused re-suspension')
            return redirect(
              CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '&pending=true#chat-end',
            )
          }

          log('approval complete')
          return redirect(CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '#chat-end')
        } catch (error) {
          log(
            'approval error: ' +
              sanitizeLog(error instanceof Error ? error.message : String(error)),
          )
          return redirect(
            CHAT_INDEX +
              '?threadId=' +
              encodeURIComponent(threadId) +
              '&error=' +
              encodeURIComponent('Fehler bei der Bestätigung.'),
          )
        }
      },
      async decline(context) {
        let runId = context.formData.get('runId')?.toString()
        let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
        let threadId = context.formData.get('threadId')?.toString()
        if (!runId || !threadId) {
          return redirect(CHAT_INDEX + '?error=' + encodeURIComponent('Ungültige Anfrage.'))
        }

        let user = getCurrentUser()
        let log = (...args: unknown[]) =>
          context.get(Logger)?.(
            `[MastraChat] [decline] [user:${user.id}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`,
          )

        log('declining tool call: ' + sanitizeLog(runId))

        try {
          let agent = mastra.getAgent('supportAgent')
          let result = (await runWithAdminId(user.id, () =>
            agent.declineToolCallGenerate({ runId, toolCallId }),
          )) as {
            finishReason?: string
            suspendPayload?: { toolCallId?: string }
            text?: string
            runId?: string
          }

          if (result.finishReason === 'suspended') {
            let sp = result.suspendPayload as { toolCallId?: string } | undefined
            let session = context.session
            if (session) {
              session.flash('toolApproval', {
                runId: result.runId,
                toolCallId: sp?.toolCallId,
                threadId,
                responseText: result.text,
              })
            }
            log('decline caused re-suspension')
            return redirect(
              CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '&pending=true#chat-end',
            )
          }

          log('decline complete')
          return redirect(CHAT_INDEX + '?threadId=' + encodeURIComponent(threadId) + '#chat-end')
        } catch (error) {
          log(
            'decline error: ' + sanitizeLog(error instanceof Error ? error.message : String(error)),
          )
          return redirect(
            CHAT_INDEX +
              '?threadId=' +
              encodeURIComponent(threadId) +
              '&error=' +
              encodeURIComponent('Fehler beim Ablehnen.'),
          )
        }
      },
    },
  },
)
