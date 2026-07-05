import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { Logger } from 'remix/middleware/logger'
import { redirect } from 'remix/response/redirect'

import { getConversation, createConversation, appendMessage } from '../../../data/chatlog.ts'
import type { ChatMessage } from '../../../data/chatlog.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminSupportPage } from '../../../ui/admin-support-page.tsx'
import { routes } from '../../../routes.ts'
import { getSupportAgent } from './mastra/agents/support-agent.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { getAdminIdentity, getCurrentUser } from '../../../utils/context.ts'
import { toastRedirect } from '../../../utils/error-handling.ts'
import type { AppContext } from '../../../types/context.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
})

const MAX_MESSAGE_LENGTH = 5000
const supportRateLimiter = createRateLimiter({ windowMs: 2000, perUser: true })

function sanitizeLog(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\r\n]/g, ' ').slice(0, 128)
}

export default createController<typeof routes.admin.support, AppContext>(routes.admin.support, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let log = (...args: unknown[]) => context.get(Logger)?.(`[Support] [user:${user.id}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
      log('GET index')

      let agentId = context.url.searchParams.get('agentId')
      let messages: ChatMessage[] = []

      if (agentId && !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
        log('invalid agentId format: ' + sanitizeLog(agentId))
        agentId = null
      }

      if (agentId) {
        try {
          let chat = await getConversation(context.db, agentId, user.id)
          if (chat) {
            messages = chat.conversation
            log('loaded ' + messages.length + ' messages from conversation: ' + agentId)
          }
        } catch (e) {
          log('failed to load conversation: ' + sanitizeLog(agentId) + ' ' + sanitizeLog(String(e)))
          messages = []
        }
      }

      return renderAdminPage(context.render, 'support', <AdminSupportPage messages={messages} agentId={agentId ?? undefined} />)
    },

    async action(context) {
      let user = getCurrentUser()
      let log = (...args: unknown[]) => context.get(Logger)?.(`[Support] [user:${user.id}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
      log('POST action')

      let formData = context.formData
      let rawConversationId = context.url.searchParams.get('agentId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null

      if (rawConversationId && /^[a-zA-Z0-9_-]+$/.test(rawConversationId)) {
        conversationId = rawConversationId
      } else if (rawConversationId) {
        log('invalid conversationId format: ' + sanitizeLog(rawConversationId))
      }

      let parsed = s.parseSafe(messageSchema, formData)
      if (!parsed.success) {
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      let message = parsed.value.message

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 })
      }

      if (!supportRateLimiter.attempt(user.id)) {
        return context.json({ error: 'Please wait before sending another message' }, { status: 429 })
      }

      let agentId: string = ''
      let abortController = new AbortController()
      let timeout = setTimeout(() => abortController.abort(), 60000)

      try {
        if (!conversationId) {
          agentId = await createConversation(context.db, user.id)
          log('created new conversation: ' + agentId)
        } else {
          agentId = conversationId
          log('using existing conversation: ' + agentId)
        }

        await appendMessage(context.db, agentId, user.id, { role: 'user', content: message, timestamp: Date.now() })
        log('user message saved')

        log('calling Mastra agent with memory')
        let llmStartTime = Date.now()

        let agent = getSupportAgent(context.db)
        let result = await agent.generate(message, {
          maxSteps: 10,
          abortSignal: abortController.signal,
          memory: {
            thread: agentId,
            resource: String(user.id),
          },
        })

        let llmElapsed = Date.now() - llmStartTime
        let responseText = result.text ?? ''

        log('Mastra agent response received, length: ' + responseText.length)

        if (!responseText || responseText.trim().length === 0) {
          return context.json({ error: 'No response from assistant. Please try again.' }, { status: 500 })
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

        log('Tool calls captured: ' + capturedToolCalls.length)

        await appendMessage(context.db, agentId, user.id, {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          elapsed: llmElapsed,
          toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
        })

        log('conversation saved, agentId: ' + agentId)

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'support_message',
            target_type: 'chatlog',
            target_id: agentId,
          })
        }

        let redirectUrl = routes.admin.support.index.href()
        return redirect(`${redirectUrl}?agentId=${agentId}`)
      } catch (e) {
        log('error calling agent: ' + sanitizeLog(String(e)))
        let redirectUrl = routes.admin.support.index.href()
        if (agentId) redirectUrl += `?agentId=${agentId}`
        return toastRedirect(redirectUrl, 'An error occurred while processing your message. Please try again.', true)
      } finally {
        clearTimeout(timeout)
      }
    },
  },
})
