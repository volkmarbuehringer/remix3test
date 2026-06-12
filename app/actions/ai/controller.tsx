import { generateText } from 'ai'
import { ToolLoopAgent, stepCountIs } from 'ai'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { sql } from 'remix/data-table'
import { createController } from 'remix/router'

import { getConversation, createConversation, appendMessage } from '../../lib/chatlog.ts'
import type { ChatMessage } from '../../lib/chatlog.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { routes } from '../../routes.ts'
import type { User } from '../../data/schema.ts'
import { listWorkflows, getWorkflow } from '../../workflows/registry.ts'
import { createWorkflowRun, executeWorkflow, getWorkflowRun, listWorkflowRuns } from '../../workflows/engine.ts'
import { baseTools } from '../../workflows/tools.ts'
import { AgentResultFragment } from '../../ui/ai-fragments/agent-result-fragment.tsx'
import { AgentPage } from '../../ui/agent-page.tsx'
import { ChatPage } from '../../ui/chat-page.tsx'
import { renderAiPage } from '../../ui/ai-layout.tsx'
import { AiDashboardContent } from '../../ui/ai-page.tsx'
import { WorkflowPage } from '../../ui/workflow-page.tsx'
import { WorkflowRunPage } from '../../ui/workflow-run-page.tsx'
import { getModel } from '../../utils/ai-provider.ts'
import { Logger } from 'remix/middleware/logger'
import { getCurrentUser } from '../../utils/context.ts'
import { toastRedirect } from '../../utils/error-handling.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
})

const MAX_MESSAGE_LENGTH = 5000

// ── Dashboard ──

export default createController(routes.ai, {
  middleware: [requireAuth()],

  actions: {
    index(context) {
      return renderAiPage(context.render, 'dashboard', <AiDashboardContent />)
    },
  },
})

// ── Chat ──

const chatRateLimiter = createRateLimiter({ windowMs: 2000, perUser: true })

const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer user questions conversationally and helpfully.`

export const aiChat = createController(routes.ai.chat, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let logger = (...args: string[]) => context.get(Logger)?.(`[Chat] [user:${user.id}] ${args.join(' ')}`)
      logger('GET index - SSR with conversation history')

      let chatId = context.url.searchParams.get('chatId')
      let error = context.url.searchParams.get('error')
      let messages: ChatMessage[] = []

      if (chatId && !/^[a-zA-Z0-9_-]+$/.test(chatId)) {
        logger('invalid chatId format: ' + chatId)
        chatId = null
      }

      if (chatId) {
        try {
          let chat = await getConversation(chatId, user.id)
          if (chat) {
            messages = chat.conversation
            logger('loaded ' + messages.length + ' messages from conversation: ' + chatId)
          } else {
            logger('conversation not found: ' + chatId)
          }
        } catch (e) {
          logger('failed to load conversation: ' + chatId + ' ' + String(e))
          messages = []
        }
      }

      return renderAiPage(context.render, 'chat', <ChatPage messages={messages} chatId={chatId ?? undefined} error={error ?? undefined} />)
    },

    async action(context) {
      let user = getCurrentUser()
      let log = (...args: unknown[]) => context.get(Logger)?.(`[Chat] [user:${user.id}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
      log('POST action - processing message')

      if (!chatRateLimiter.attempt(user.id)) {
        return context.json({ error: 'Please wait before sending another message' }, { status: 429 })
      }
      let formData = context.formData
      let rawConversationId = context.url.searchParams.get('chatId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null

      if (rawConversationId && /^[a-zA-Z0-9_-]+$/.test(rawConversationId)) {
        conversationId = rawConversationId
      } else if (rawConversationId) {
        log('invalid conversationId format: ' + rawConversationId)
      }

      let parsed = s.parseSafe(messageSchema, formData)
      if (!parsed.success) {
        log('message validation failed')
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      let message = parsed.value.message

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        log('empty message rejected')
        return context.json({ error: 'Please enter a message' }, { status: 400 })
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        log('message too long: ' + message.length)
        return context.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` }, { status: 400 })
      }

      let chatId: string
      if (!conversationId) {
        chatId = await createConversation(user.id)
        log('created new conversation: ' + chatId)
      } else {
        chatId = conversationId
        log('using existing conversation: ' + chatId)
      }

      try {
        log('calling LLM with generateText')

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

        log('LLM finished: ' + JSON.stringify({
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          finishReason: result.finishReason,
        }))

        if (!responseText || responseText.trim().length === 0) {
          log('empty LLM response for chatId: ' + chatId)
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

        log('conversation saved, chatId: ' + chatId)

        let redirectUrl = new URL('/ai/chat', context.url.origin)
        redirectUrl.searchParams.set('chatId', chatId)
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl.toString() },
        })
      } catch (e) {
        log('error calling LLM: ' + String(e))

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

// ── Agent ──

const tools = { ...baseTools }

export const aiAgent = createController(routes.ai.agent, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let logger = (...args: string[]) => context.get(Logger)?.(`[Agent] [user:${user.id}] ${args.join(' ')}`)
      logger('GET index - SSR with conversation history')
      let agentId = context.url.searchParams.get('agentId')
      let messages: ChatMessage[] = []

      if (agentId && !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
        logger('invalid agentId format: ' + agentId)
        agentId = null
      }

      if (agentId) {
        try {
          let chat = await getConversation(agentId, user.id)
          if (chat) {
            messages = chat.conversation
            logger('loaded ' + messages.length + ' messages from conversation: ' + agentId)
          }
        } catch (e) {
          logger('failed to load conversation: ' + agentId + ' ' + String(e))
          messages = []
        }
      }

      return renderAiPage(context.render, 'agent', <AgentPage messages={messages} agentId={agentId ?? undefined} />)
    },

    async action(context) {
      let user = getCurrentUser()
      let log = (...args: unknown[]) => context.get(Logger)?.(`[Agent] [user:${user.id}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`)
      log('POST action - processing message')
      let formData = context.formData
      let rawConversationId = context.url.searchParams.get('agentId') ?? formData.get('conversationId')?.toString() ?? null
      let conversationId: string | null = null

      if (rawConversationId && /^[a-zA-Z0-9_-]+$/.test(rawConversationId)) {
        conversationId = rawConversationId
      } else if (rawConversationId) {
        log('invalid conversationId format: ' + rawConversationId)
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

      log('message parsed: ' + message + ' conversationId: ' + conversationId)

      let chatId: string
      if (!conversationId) {
        chatId = await createConversation(user.id)
        log('created new conversation: ' + chatId)
      } else {
        chatId = conversationId
        log('using existing conversation: ' + chatId)
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
        log('messages with history: ' + messages.length + ' messages')

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
        log('Agent response received, length: ' + responseText.length)

        if (!responseText || responseText.trim().length === 0) {
          return context.json({ error: 'No response from assistant. Please try again.' }, { status: 500 })
        }

        log('Tool calls captured: ' + capturedToolCalls.length)

        await appendMessage(chatId, user.id, { role: 'user', content: message, timestamp: Date.now() })
        await appendMessage(chatId, user.id, {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
          elapsed: llmElapsed,
          tokens: totalTokens.total > 0 ? { input: totalTokens.input, output: totalTokens.output, total: totalTokens.total } : undefined,
          toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
        })

        log('conversation saved, chatId: ' + chatId)

        let redirectUrl = new URL(routes.ai.agent.index.href(), context.url.origin)
        redirectUrl.searchParams.set('agentId', chatId)
        return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } })
      } catch (e) {
        log('error calling agent: ' + String(e))
        let redirectUrl = new URL(routes.ai.agent.index.href(), context.url.origin)
        if (chatId) redirectUrl.searchParams.set('agentId', chatId)
        return toastRedirect(redirectUrl.toString(), 'An error occurred while processing your message. Please try again.', true)
      }
    },
  },
})

// ── Workflow ──

const workflowSchema = f.object({
  workflowId: f.field(s.string()),
})

export const aiWorkflow = createController(routes.ai.workflow, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let user = getCurrentUser()
      let log = (msg: string) => context.get(Logger)?.(`[Workflow] [user:${user.id}] ${msg}`)

      log('GET index: ' + JSON.stringify({ hasDb: !!context.db, hasAuth: !!context.auth, authOk: context.auth?.ok }))

      let runId = context.url.searchParams.get('runId')

      if (runId) {
        let run = await getWorkflowRun(context.db, runId)
        if (!run) {
          return renderAiPage(context.render, 'workflow', <WorkflowRunPage error="Workflow run not found" />)
        }

        return renderAiPage(context.render, 'workflow', <WorkflowRunPage run={run} />)
      }

      let workflows = listWorkflows()
      let recentRuns = await listWorkflowRuns(context.db, 20)

      log('loaded: ' + JSON.stringify({ workflows: workflows.length, runs: recentRuns.length }))

      return renderAiPage(context.render, 'workflow', <WorkflowPage workflows={workflows} recentRuns={recentRuns} />)
    },

    async action(context) {
      let db = context.db
      let auth = context.auth
      let formData = context.formData
      let user = getCurrentUser()
      let log = (msg: string) => context.get(Logger)?.(`[Workflow] [user:${user.id}] ${msg}`)
      let engineLog = { log: (...args: unknown[]) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')), warn: (...args: unknown[]) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')), error: (...args: unknown[]) => log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')) }

      log('POST action: ' + JSON.stringify({
        hasDb: !!db, hasAuth: !!auth, authOk: auth?.ok,
        formEntries: Array.from(formData.entries()).length
      }))

      let parsed = s.parseSafe(workflowSchema, formData)
      if (!parsed.success) {
        return context.json({ error: 'Workflow ID is required' }, { status: 400 })
      }
      let workflowId = parsed.value.workflowId

      let workflow = getWorkflow(workflowId)
      if (!workflow) {
        log('workflow not found: ' + workflowId)
        return context.json({ error: 'Workflow not found' }, { status: 404 })
      }

      let params: Record<string, unknown> = {}
      for (let param of (workflow.parameters ?? [])) {
        let value = formData.get(param.name)?.toString()
        if (value) {
          if (param.type === 'number') params[param.name] = Number(value)
          else if (param.type === 'boolean') params[param.name] = value === 'true'
          else params[param.name] = value
        }
      }

      log('parsed params: ' + JSON.stringify(params))

      let userId = auth?.ok ? (auth.identity as { id: number }).id : null
      let runId = await createWorkflowRun(db, workflowId, params, userId)

      log('created run: ' + JSON.stringify({ runId, workflowId, userId }))

      executeWorkflow(runId, {
        workflowId, params, db,
        user: auth?.ok ? (auth.identity as User) : null,
        logger: engineLog,
      }).catch(async error => {
        let errorMessage = error instanceof Error ? error.message : String(error)
        log('execution failed: ' + errorMessage)
        await db.exec(sql`UPDATE workflow_runs SET status = 'failed', error = ${errorMessage}, completed_at = ${Date.now()} WHERE id = ${runId}`)
      })

      let redirectUrl = routes.ai.workflow.index.href()
      return new Response(null, {
        status: 303,
        headers: { Location: `${redirectUrl}?runId=${runId}` },
      })
    },
  },
})

// ── Fragments ──

export const aiFragments = createController(
  routes.ai.fragments,
  {
    middleware: [requireAuth()],

    actions: {
      async agentResult(context) {
        await delay(100)

        let prompt = context.url.searchParams.get('prompt') ?? 'No prompt provided'

        let now = new Date()
        let result = {
          prompt,
          response: `Processed at ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}. The agent analyzed "${prompt.substring(0, 50)}" and generated a response.`,
          executionTime: `${(Math.random() * 2 + 0.5).toFixed(1)}s`,
          steps: [
            { name: 'analyze', status: 'complete', duration: '0.3s' },
            { name: 'process', status: 'complete', duration: '0.5s' },
            { name: 'format', status: 'complete', duration: '0.1s' },
          ],
        }

        return context.render(
          <AgentResultFragment result={result} />,
          fragmentResponseInit(),
        )
      },
    },
  },
)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
