import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Logger } from 'remix/middleware/logger'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes } from '../../routes.ts'
import { mastra } from './index.ts'
import { getCurrentUser, getAdminIdentity } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { createConversation, appendMessage, getConversation } from '../../data/chatlog.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { MastraChatPage } from '../../ui/admin-mastra-chat-page.tsx'
import type { AppContext } from '../../types/context.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
  threadId: f.field(s.optional(s.string())),
})

const THREAD_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/
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
let _testAgent: any
export function __setTestAgent(agent: any) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}

export const mastraChat = createController<typeof routes.mastra.chat, AppContext>(routes.mastra.chat, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      let threadId = context.url.searchParams.get('threadId') ?? undefined
      let error = context.url.searchParams.get('error') ?? undefined
      let result: string | undefined
      if (threadId) {
        let conv = await getConversation(context.db, threadId)
        if (conv) {
          let assistantMsgs = conv.conversation.filter(m => m.role === 'assistant')
          if (assistantMsgs.length > 0) {
            result = assistantMsgs[assistantMsgs.length - 1].content
          }
        }
      }
      return renderAdminPage(context.render, 'support', <MastraChatPage response={result} threadId={threadId} error={error} />)
    },
    async action(context) {
      let user = getCurrentUser()
      let log = (...args: unknown[]) => context.get(Logger)?.(`[MastraChat] [user:${user.id}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)

      log('POST action start')

      let parsed = s.parseSafe(messageSchema, context.formData)
      if (!parsed.success) {
        log('validation failed: missing message')
        if (wantsJson(context)) {
          return context.json({ error: 'Please enter a message' }, { status: 400 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Bitte gib eine Nachricht ein.'))
      }

      let message = parsed.value.message
      if (!message || message.trim().length === 0) {
        log('validation failed: empty message')
        if (wantsJson(context)) {
          return context.json({ error: 'Please enter a message' }, { status: 400 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Bitte gib eine Nachricht ein.'))
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        log('validation failed: message too long: ' + message.length)
        if (wantsJson(context)) {
          return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent(`Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`))
      }

      let threadId = parsed.value.threadId
      if (threadId && !THREAD_ID_RE.test(threadId)) {
        log('invalid threadId format: ' + sanitizeLog(threadId))
        if (wantsJson(context)) {
          return context.json({ error: 'Invalid thread ID format' }, { status: 400 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Ungültiges Thread-ID-Format.'))
      }

      if (!chatRateLimiter.attempt(user.id)) {
        log('rate limited')
        if (wantsJson(context)) {
          return context.json({ error: 'Please wait before sending another message' }, { status: 429 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.'))
      }

      if (!threadId) {
        threadId = await createConversation(context.db, user.id)
        log('new chatlog conversation created: ' + sanitizeLog(threadId))
      } else {
        log('continuing thread: ' + sanitizeLog(threadId))
      }

      let llmStartTime = Date.now()
      let abortController = new AbortController()
      let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

      try {
        await appendMessage(context.db, threadId, user.id, { role: 'user', content: message, timestamp: Date.now() })
        log('user message saved to chatlog')

        let agent = process.env.NODE_ENV === 'test' && _testAgent ? _testAgent : mastra.getAgent('supportAgent')
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
            return context.json({ error: 'No response from assistant. Please try again.' }, { status: 500 })
          }
          return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Keine Antwort erhalten. Bitte versuche es erneut.'))
        }

        let capturedToolCalls = (result.toolCalls ?? []).map((tc: unknown, i: number) => {
          let tcObj = tc as Record<string, unknown> | undefined
          let tr = ((result.toolResults ?? []) as unknown as Array<Record<string, unknown>> | undefined)?.[i]
          return {
            name: typeof tcObj?.toolName === 'string' ? tcObj.toolName : '',
            input: (typeof tcObj?.args === 'object' && tcObj.args != null ? tcObj.args : {}) as Record<string, unknown>,
            result: tr?.result,
            timestamp: Date.now(),
          }
        })
        log('tool calls captured: ' + capturedToolCalls.length)

        try {
          await appendMessage(context.db, threadId, user.id, {
            role: 'assistant',
            content: responseText,
            timestamp: Date.now(),
            elapsed: llmElapsed,
            toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
          })
          log('assistant response saved to chatlog')
        } catch (err) {
          log('failed to save assistant response to chatlog: ' + sanitizeLog(err instanceof Error ? err.message : String(err)))
        }

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'support_message',
            target_type: 'chatlog',
            target_id: threadId,
          })
        }

        log('success, response length: ' + responseText.length)
        if (wantsJson(context)) {
          return context.json({ response: responseText, threadId })
        }
        let url = routes.mastra.chat.index.href() + '?threadId=' + encodeURIComponent(threadId)
        return redirect(url)
      } catch (error) {
        log('error: ' + sanitizeLog(error instanceof Error ? error.message : String(error)))
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || /abort/i.test(error.message))) {
          if (wantsJson(context)) {
            return context.json({ error: 'Request timed out. Please try again.' }, { status: 504 })
          }
          return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.'))
        }
        if (wantsJson(context)) {
          return context.json({ error: 'An error occurred while processing your message.' }, { status: 500 })
        }
        return redirect(routes.mastra.chat.index.href() + '?error=' + encodeURIComponent('Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuche es erneut.'))
      } finally {
        clearTimeout(timeout)
      }
    },
  },
})
