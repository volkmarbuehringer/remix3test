import { createController } from 'remix/router'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'
import { generateText } from 'ai'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { getConversation } from '../../lib/chatlog.ts'
import type { ChatMessage } from '../../lib/chatlog.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { ChatPage } from '../../ui/chat-page.tsx'
import { renderAiPage } from '../../ui/ai-layout.tsx'
import { createConversation, appendMessage } from '../../lib/chatlog.ts'
import { getModel } from '../../utils/ai-provider.ts'
import { userLogger } from '../../utils/logger.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
})

const MAX_MESSAGE_LENGTH = 5000
const chatRateLimiter = createRateLimiter({ windowMs: 2000 })

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer user questions conversationally and helpfully.`

export default createController<typeof routes.ai.chat, AppContext>(routes.ai.chat, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let logger = userLogger('Chat')
      logger.log('GET index - SSR with conversation history')

      let user = getCurrentUser()
      let chatId = context.url.searchParams.get('chatId')
      let error = context.url.searchParams.get('error')
      let messages: ChatMessage[] = []

      if (chatId && !/^[a-zA-Z0-9_-]+$/.test(chatId)) {
        logger.warn('invalid chatId format:', chatId)
        chatId = null
      }

      if (chatId) {
        try {
          let chat = await getConversation(chatId, user.id)
          if (chat) {
            messages = chat.conversation
            logger.log('loaded', messages.length, 'messages from conversation:', chatId)
          } else {
            logger.log('conversation not found:', chatId)
          }
        } catch (e) {
          logger.error('failed to load conversation:', chatId, e)
          messages = []
        }
      }

      return renderAiPage(context.render, 'chat', <ChatPage messages={messages} chatId={chatId ?? undefined} error={error ?? undefined} />)
    },

    async action(context) {
      let logger = userLogger('Chat')
      logger.log('POST action - processing message')

      if (!chatRateLimiter.attempt()) {
        return context.json({ error: 'Please wait before sending another message' }, { status: 429 })
      }

      let user = getCurrentUser()
      let formData = context.formData
      let rawConversationId = context.url.searchParams.get('chatId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null

      if (rawConversationId && /^[a-zA-Z0-9_-]+$/.test(rawConversationId)) {
        conversationId = rawConversationId
      } else if (rawConversationId) {
        logger.warn('invalid conversationId format:', rawConversationId)
      }

      let parsed = s.parseSafe(messageSchema, formData)
      if (!parsed.success) {
        logger.log('message validation failed')
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      let message = parsed.value.message

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        logger.log('empty message rejected')
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        logger.log('message too long:', message.length)
        return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 })
      }

      let chatId: string
      if (!conversationId) {
        chatId = await createConversation(user.id)
        logger.log('created new conversation:', chatId)
      } else {
        chatId = conversationId
        logger.log('using existing conversation:', chatId)
      }

      try {
        logger.log('calling LLM with generateText')

        let existingChat = await getConversation(chatId, user.id)
        let llmMessages: Array<{ role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string }> }> = []

        if (existingChat) {
          for (let msg of existingChat.conversation) {
            llmMessages.push({
              role: msg.role,
              content: [{ type: 'text', text: msg.content }],
            })
          }
        }

        llmMessages.push({
          role: 'user',
          content: [{ type: 'text', text: message }],
        })

        let llmStartTime = Date.now()

        let result = await generateText({
          model: getModel(),
          maxOutputTokens: 1024,
          system: SYSTEM_PROMPT,
          messages: llmMessages,
          timeout: 20000,
        })

        let responseText = result.text
        let llmElapsed = Date.now() - llmStartTime

        logger.log('LLM finished:', {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          finishReason: result.finishReason,
        })

        if (!responseText || responseText.trim().length === 0) {
          logger.warn('empty LLM response for chatId:', chatId)
          return context.json({ error: 'No response from assistant. Please try again.' }, { status: 500 })
        }

        await appendMessage(chatId, user.id, {
          role: 'user',
          content: message,
          timestamp: Date.now(),
        })

        await appendMessage(chatId, user.id, {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          elapsed: llmElapsed,
          tokens: result.usage.inputTokens !== undefined
            ? {
                input: result.usage.inputTokens,
                output: result.usage.outputTokens ?? 0,
                total: result.usage.totalTokens ?? 0,
              }
            : undefined,
        })

        logger.log('conversation saved, chatId:', chatId)

        let redirectUrl = new URL('/ai/chat', context.url.origin)
        redirectUrl.searchParams.set('chatId', chatId)
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() },
        })
      } catch (e) {
        logger.error('error calling LLM:', e)

        let redirectUrl = new URL('/ai/chat', context.url.origin)
        redirectUrl.searchParams.set('chatId', chatId)
        redirectUrl.searchParams.set('error', 'Sorry, the AI assistant encountered an error. Please try again.')
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() },
        })
      }
    },
  },
})
