import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Logger } from 'remix/middleware/logger'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes, frames } from '../../routes.ts'
import { mastra } from './index.ts'
import { getCurrentUser, getAdminIdentity } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'

import { logAdminAction } from '../../data/audit-log.ts'
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { Layout } from '../../ui/layout.tsx'
import { MastraChatPage } from '../../ui/admin-mastra-chat-page.tsx'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import type { AppContext } from '../../types/context.ts'
import type { ChatMessage } from '../../types/chatlog.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
  threadId: f.field(s.optional(s.string())),
})

const MAX_MESSAGE_LENGTH = 5000
const AGENT_TIMEOUT_MS = 60_000
const chatRateLimiter = createRateLimiter({ windowMs: 2000, perUser: true })

function sanitizeLog(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\r\n]/g, ' ').slice(0, 128)
}

function wantsJson(context: AppContext): boolean {
  return context.request.headers.get('Accept')?.includes('application/json') ?? false
}

export { chatRateLimiter }

// Test-only agent injection point — setter is a no-op outside test env
let _testAgent:
  | {
      generate: (
        message: string,
        opts?: Record<string, unknown>,
      ) => Promise<{ text: string; toolCalls?: unknown[]; toolResults?: unknown[] }>
    }
  | undefined
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
        let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
        if (isFrameRequest) {
          return renderAdminPage(
            context.render,
            'support',
            <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />,
          )
        }
        return context.render(
          <Layout>
            <AdminLayout activeItem="support">
              <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
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

        let parsed = s.parseSafe(messageSchema, context.formData)
        if (!parsed.success) {
          log('validation failed: missing message')
          if (wantsJson(context)) {
            return context.json({ error: 'Please enter a message' }, { status: 400 })
          }
          return redirect(
            routes.mastra.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }

        let message = parsed.value.message
        if (!message || message.trim().length === 0) {
          log('validation failed: empty message')
          if (wantsJson(context)) {
            return context.json({ error: 'Please enter a message' }, { status: 400 })
          }
          return redirect(
            routes.mastra.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
          log('validation failed: message too long: ' + message.length)
          if (wantsJson(context)) {
            return context.json(
              { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` },
              { status: 400 },
            )
          }
          return redirect(
            routes.mastra.chat.index.href() +
              '?error=' +
              encodeURIComponent(`Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`),
          )
        }

        let threadId = parsed.value.threadId
        if (threadId && !validateThreadId(threadId)) {
          log('invalid threadId format: ' + sanitizeLog(threadId))
          if (wantsJson(context)) {
            return context.json({ error: 'Invalid thread ID format' }, { status: 400 })
          }
          return redirect(
            routes.mastra.chat.index.href() +
              '?error=' +
              encodeURIComponent('Ungültiges Thread-ID-Format.'),
          )
        }

        if (!chatRateLimiter.attempt(user.id)) {
          log('rate limited')
          if (wantsJson(context)) {
            return context.json(
              { error: 'Please wait before sending another message' },
              { status: 429 },
            )
          }
          return redirect(
            routes.mastra.chat.index.href() +
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

        let llmStartTime = Date.now()
        let abortController = new AbortController()
        let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

        try {
          let agent =
            process.env.NODE_ENV === 'test' && _testAgent
              ? _testAgent
              : mastra.getAgent('supportAgent')
          log('agent ready')

          log('calling agent.generate')
          let result = await agent.generate(message, {
            maxSteps: 10,
            abortSignal: abortController.signal,
            memory: {
              thread: threadId,
              resource: String(user.id),
            },
          })

          let llmElapsed = Date.now() - llmStartTime
          let responseText = result.text ?? ''
          if (!responseText.trim()) {
            log('agent returned empty response')
            if (wantsJson(context)) {
              return context.json(
                { error: 'No response from assistant. Please try again.' },
                { status: 500 },
              )
            }
            return redirect(
              routes.mastra.chat.index.href() +
                '?error=' +
                encodeURIComponent('Keine Antwort erhalten. Bitte versuche es erneut.'),
            )
          }

          let capturedToolCalls = (result.toolCalls ?? []).map((tc: unknown, i: number) => {
            let tcObj = tc as Record<string, unknown> | undefined
            let tr = (
              (result.toolResults ?? []) as unknown as Array<Record<string, unknown>> | undefined
            )?.[i]
            return {
              name: typeof tcObj?.toolName === 'string' ? tcObj.toolName : '',
              input: (typeof tcObj?.args === 'object' && tcObj.args != null
                ? tcObj.args
                : {}) as Record<string, unknown>,
              result: tr?.result,
              timestamp: Date.now(),
            }
          })
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
          if (wantsJson(context)) {
            return context.json({ response: responseText, threadId })
          }
          let url =
            routes.mastra.chat.index.href() +
            '?threadId=' +
            encodeURIComponent(threadId) +
            '#chat-end'
          return redirect(url)
        } catch (error) {
          log('error: ' + sanitizeLog(error instanceof Error ? error.message : String(error)))
          if (
            error instanceof Error &&
            (error.name === 'AbortError' ||
              error.name === 'TimeoutError' ||
              /abort/i.test(error.message))
          ) {
            if (wantsJson(context)) {
              return context.json(
                { error: 'Request timed out. Please try again.' },
                { status: 504 },
              )
            }
            return redirect(
              routes.mastra.chat.index.href() +
                '?error=' +
                encodeURIComponent('Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.'),
            )
          }
          if (wantsJson(context)) {
            return context.json(
              { error: 'An error occurred while processing your message.' },
              { status: 500 },
            )
          }
          return redirect(
            routes.mastra.chat.index.href() +
              '?error=' +
              encodeURIComponent(
                'Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuche es erneut.',
              ),
          )
        } finally {
          clearTimeout(timeout)
        }
      },
    },
  },
)
