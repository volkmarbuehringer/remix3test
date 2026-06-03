import { createController } from 'remix/router'
import * as f from 'remix/data-schema/form-data'
import * as s from 'remix/data-schema'

import { aiRoutes as routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { ToolLoopAgent, stepCountIs } from 'ai'
import { getConversation } from '../lib/chatlog.ts'
import type { ChatMessage } from '../lib/chatlog.ts'
import { getCurrentUser } from '../utils/context.ts'
import { AgentPage } from '../ui/agent-page.tsx'
import { renderAiPage } from '../ui/ai-layout.tsx'
import { userLogger } from '../utils/logger.ts'
import { createConversation, appendMessage } from '../lib/chatlog.ts'
import { getModel } from '../utils/ai-provider.ts'
import { toastRedirect } from '../utils/error-handling.ts'
import { baseTools } from '../workflows/tools.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
})

const MAX_MESSAGE_LENGTH = 5000

const tools = { ...baseTools }

export default createController<typeof routes.ai.agent, AppContext>(routes.ai.agent, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let logger = userLogger('Agent')
      logger.log('GET index - SSR with conversation history')

      let user = getCurrentUser()
      let agentId = context.url.searchParams.get('agentId')
      let messages: ChatMessage[] = []

      if (agentId && !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
        logger.warn('invalid agentId format:', agentId)
        agentId = null
      }

      if (agentId) {
        try {
          let chat = await getConversation(agentId, user.id)
          if (chat) {
            messages = chat.conversation
            logger.log('loaded', messages.length, 'messages from conversation:', agentId)
          }
        } catch (e) {
          logger.error('failed to load conversation:', agentId, e)
          messages = []
        }
      }

      return renderAiPage(context.render, 'agent', <AgentPage messages={messages} agentId={agentId ?? undefined} />)
    },

    async action(context) {
      let logger = userLogger('Agent')
      logger.log('POST action - processing message')

      let user = getCurrentUser()
      let formData = context.formData
      let rawConversationId = context.url.searchParams.get('agentId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null

      if (rawConversationId && /^[a-zA-Z0-9_-]+$/.test(rawConversationId)) {
        conversationId = rawConversationId
      } else if (rawConversationId) {
        logger.warn('invalid conversationId format:', rawConversationId)
      }

      let parseResult = s.parse(messageSchema, formData) as { message?: string }
      let message = parseResult.message

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }
      if (message.length > MAX_MESSAGE_LENGTH) {
        return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 })
      }

      logger.log('message parsed:', message, 'conversationId:', conversationId)

      let chatId: string
      if (!conversationId) {
        chatId = await createConversation(user.id)
        logger.log('created new conversation:', chatId)
      } else {
        chatId = conversationId
        logger.log('using existing conversation:', chatId)
      }

      try {
        let existingChat = await getConversation(chatId, user.id)
        let messages: Array<{ role: 'user' | 'assistant'; content: Array<{ type: 'text'; text: string }> }> = []

        if (existingChat) {
          for (let msg of existingChat.conversation) {
            messages.push({ role: msg.role, content: [{ type: 'text', text: msg.content }] })
          }
        }

        messages.push({ role: 'user', content: [{ type: 'text', text: message }] })
        logger.log('messages with history:', messages.length, 'messages')

        let controller = new AbortController()
        let timeout = setTimeout(() => controller.abort(), 60000)
        let llmStartTime = Date.now()

        let totalTokens = { input: 0, output: 0, total: 0 }
        let capturedToolCalls: Array<{ name: string; input: Record<string, unknown>; result?: unknown; timestamp: number }> = []

        let agent = new ToolLoopAgent({
          model: getModel(),
          tools,
          stopWhen: stepCountIs(10),
          instructions: `You are a helpful AI assistant with access to tools.

Available tools:
- get_weather: Get current weather for any city/location worldwide
- search_wikipedia: Search Wikipedia for information on any topic

When the user asks about weather, use the get_weather tool.
When the user asks about factual information, use search_wikipedia.
Use tools to provide accurate, real-time information.`,
          onStepFinish: async ({ stepNumber: _, usage, toolCalls, toolResults, text: __ }) => {
            if (usage) {
              totalTokens.input += usage.inputTokens ?? 0
              totalTokens.output += usage.outputTokens ?? 0
              totalTokens.total += usage.totalTokens ?? 0
            }
            if (toolCalls) {
              for (let call of toolCalls) {
                let toolResult = toolResults?.find(tr => tr.toolName === call.toolName)
                let resultValue = toolResult ? (toolResult as unknown as Record<string, unknown>).output : undefined
                capturedToolCalls.push({ name: call.toolName, input: (call.input ?? {}) as Record<string, unknown>, result: resultValue ?? undefined, timestamp: Date.now() })
              }
            }
          },
        })

        let result = await agent.generate({ messages, abortSignal: controller.signal })
        clearTimeout(timeout)
        let llmElapsed = Date.now() - llmStartTime

        let responseText = result.steps?.map(step => step.text).join('') ?? result.text ?? ''
        logger.log('Agent response received, length:', responseText.length)

        if (!responseText || responseText.trim().length === 0) {
          return context.json({ error: 'No response from assistant. Please try again.' }, { status: 500 })
        }

        logger.log('Tool calls captured:', capturedToolCalls.length)

        await appendMessage(chatId, user.id, { role: 'user', content: message, timestamp: Date.now() })
        await appendMessage(chatId, user.id, {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          elapsed: llmElapsed,
          tokens: totalTokens.total > 0 ? { input: totalTokens.input, output: totalTokens.output, total: totalTokens.total } : undefined,
          toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
        })

        logger.log('conversation saved, chatId:', chatId)

        let redirectUrl = new URL('/ai/agent', context.url.origin)
        redirectUrl.searchParams.set('agentId', chatId)
        return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } })
      } catch (e) {
        logger.error('error calling agent:', e)
        let redirectUrl = new URL('/ai/agent', context.url.origin)
        if (chatId) redirectUrl.searchParams.set('agentId', chatId)
        return toastRedirect(redirectUrl.toString(), 'An error occurred while processing your message. Please try again.', true)
      }
    },
  },
})
