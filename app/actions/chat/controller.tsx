import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { mastra } from '../mastra/index.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import { Layout } from '../../ui/layout.tsx'
import { CustomerChatPage } from '../../ui/customer-chat-page.tsx'
import type { AppContext } from '../../types/context.ts'
import type { ChatMessage } from '../../types/chatlog.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
  threadId: f.field(s.optional(s.string())),
})

const MAX_MESSAGE_LENGTH = 5000
const AGENT_TIMEOUT_MS = 60_000
export const chatRateLimiter = createRateLimiter({ windowMs: 3000, perUser: true })

// Test-only agent injection point — setter is a no-op outside test env
let _testAgent:
  | {
      generate: (
        message: string,
        opts?: Record<string, unknown>,
      ) => Promise<{ text: string; toolCalls?: unknown[]; toolResults?: unknown[] }>
    }
  | undefined
export function __setTestCustomerAgent(agent: typeof _testAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}
export function __getTestCustomerAgent() {
  return _testAgent
}

export const customerChat = createController<typeof routes.chat, AppContext>(
  routes.chat,
  {
    middleware: [requireAuth()],
    actions: {
      async index(context) {
        let user = getCurrentUser()
        let threadId = context.url.searchParams.get('threadId') ?? undefined
        if (threadId && !validateThreadId(threadId)) threadId = undefined
        let error = context.url.searchParams.get('error') ?? undefined
        let chatMessages: ChatMessage[] = []
        if (threadId) {
          try {
            let agent = mastra.getAgent('customerAgent')
            chatMessages = await recallChatMessages(agent, threadId, String(user.id))
          } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
              console.error('[CustomerChat] recall failed for ' + threadId + ': ' + String(error))
            }
          }
        }

        return context.render(
          <Layout>
            <CustomerChatPage messages={chatMessages} threadId={threadId} error={error} />
          </Layout>,
        )
      },

      async action(context) {
        let user = getCurrentUser()

        let parsed = s.parseSafe(messageSchema, context.formData)
        if (!parsed.success) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }

        let message = parsed.value.message
        if (!message || message.trim().length === 0) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent(`Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`),
          )
        }

        let threadId = parsed.value.threadId
        if (threadId && !validateThreadId(threadId)) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Ungültiges Thread-ID-Format.'),
          )
        }

        if (!chatRateLimiter.attempt(user.id)) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent(
                'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.',
              ),
          )
        }

        if (!threadId) {
          threadId = crypto.randomUUID()
        }

        let abortController = new AbortController()
        let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

        try {
          let agent =
            process.env.NODE_ENV === 'test' && _testAgent
              ? _testAgent
              : mastra.getAgent('customerAgent')

          let result = await agent.generate(message, {
            maxSteps: 5,
            abortSignal: abortController.signal,
            memory: {
              thread: threadId,
              resource: String(user.id),
            },
          })

          let responseText = result.text ?? ''
          if (!responseText.trim()) {
            return redirect(
              routes.chat.index.href() +
                '?error=' +
                encodeURIComponent('Keine Antwort erhalten. Bitte versuche es erneut.'),
            )
          }

          let url =
            routes.chat.index.href() +
            '?threadId=' +
            encodeURIComponent(threadId) +
            '#chat-end'
          return redirect(url)
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === 'AbortError' ||
              error.name === 'TimeoutError' ||
              /abort/i.test(error.message))
          ) {
            return redirect(
              routes.chat.index.href() +
                '?error=' +
                encodeURIComponent(
                  'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.',
                ),
            )
          }
          return redirect(
            routes.chat.index.href() +
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
