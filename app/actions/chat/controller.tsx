import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { mastra } from '../mastra/index.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { runWithUserId } from '../mastra/tools/customer-tools.ts'
import {
  sseHeaders,
  sseErrorResponse,
  sseEvent,
  pipeStream,
  safeClose,
} from '../../utils/agent-sse.ts'
import { recordChatRun, findChatRunOwner, clearChatRun } from './run-store.ts'
import { Layout } from '../../ui/layout.tsx'
import { CustomerChatPage } from '../../ui/customer-chat-page.tsx'
import { createLogger } from '../../utils/logger.ts'
import {
  MAX_MESSAGE_LENGTH,
  AGENT_TIMEOUT_MS,
  validateMessage,
  sanitizeLog,
} from '../mastra/shared-agent.ts'
import type { TestAgent } from '../mastra/shared-agent.ts'

// Anti-spam throttle: allow a normal multi-turn conversation (a couple of
// messages plus approve/decline/answer steps) per minute, while capping abuse.
// maxAttempts MUST be set explicitly — the default of 1 would block the second
// message of a normal conversation within the window (see rate-limiter-pitfalls).
export const chatRateLimiter = createRateLimiter({
  windowMs: 60_000,
  perUser: true,
  maxAttempts: 10,
})
const chatLog = createLogger('[CustomerChat]')

// Test-only agent injection point — setter is a no-op outside test env.
let _testAgent: TestAgent | undefined
export function __setTestAgent(agent: typeof _testAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}

function resolveCustomerAgent(): TestAgent {
  return process.env.NODE_ENV === 'test' && _testAgent
    ? _testAgent
    : mastra.getAgent('customerAgent')
}

type ResumeResult = {
  text?: string
  finishReason?: string
  runId?: string
  suspendPayload?: Record<string, unknown>
  fullStream?: unknown
}

/**
 * Builds the streaming SSE response for an approve/decline tool decision.
 * The agent run is resolved by runId against durable Mastra storage; the
 * `chat_runs` row (checked by the caller) provides the durable ownership gate
 * so this survives a restart or scale-out.
 */
function toolDecisionStream(options: {
  runId: string
  userId: number
  threadId: string
  decision: 'approve' | 'decline'
  toolCallId?: string
  signal: AbortSignal
}): Response {
  let { runId, userId, threadId, decision, toolCallId, signal } = options

  let body = new ReadableStream({
    start: async (controller) => {
      try {
        controller.enqueue(sseEvent('start', { runId }))

        let agent = resolveCustomerAgent() as TestAgent & {
          approveToolCallGenerate: NonNullable<TestAgent['approveToolCallGenerate']>
          declineToolCallGenerate: NonNullable<TestAgent['declineToolCallGenerate']>
        }
        let result = (await runWithUserId(userId, () =>
          decision === 'approve'
            ? agent.approveToolCallGenerate({ runId, toolCallId })
            : agent.declineToolCallGenerate({ runId, toolCallId }),
        )) as ResumeResult

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
          // A re-suspension produces a continuation run; record its ownership
          // so the follow-up approve/decline/answer resolves correctly.
          if (result.runId && result.runId !== runId) {
            await recordChatRun({ runId: result.runId, userId, threadId })
          }
          if (sp?.question) {
            controller.enqueue(
              sseEvent('question', {
                runId: result.runId || runId,
                toolCallId: sp.toolCallId,
                question: sp.question,
                options: sp.options ?? null,
                selectionMode: sp.selectionMode ?? 'single_select',
              }),
            )
            controller.enqueue(sseEvent('complete', {}))
            controller.close()
            return
          }
          if (sp?.toolCallId || sp?.toolName) {
            controller.enqueue(
              sseEvent('suspension', {
                runId: result.runId || runId,
                toolCallId: sp.toolCallId,
                toolName: sp.toolName,
                args: sp.args,
              }),
            )
            controller.enqueue(sseEvent('complete', {}))
            controller.close()
            return
          }
        }

        if (result.fullStream) {
          let contRunId = result.runId || runId
          if (contRunId !== runId) {
            await recordChatRun({ runId: contRunId, userId, threadId })
          }
          await pipeStream(result.fullStream as ReadableStream, controller, signal, contRunId)
        } else {
          let text = (
            result.text || (decision === 'approve' ? '' : 'Die Aktion wurde abgelehnt.')
          ).trim()
          if (text) controller.enqueue(sseEvent('message', { text }))
          controller.enqueue(sseEvent('complete', {}))
          controller.close()
        }

        // Terminal resolution — the run no longer needs an ownership pointer.
        await clearChatRun(runId)
        if (result.runId && result.runId !== runId) await clearChatRun(result.runId)
      } catch (err) {
        chatLog.error('decision failed:', sanitizeLog(String(err)))
        try {
          controller.enqueue(
            sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung der Entscheidung.' }),
          )
        } catch {
          /* already closed */
        }
        safeClose(controller)
      }
    },
  })

  return new Response(body, { headers: sseHeaders() })
}

export const customerChat = createController(routes.chat, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      return context.render(
        <Layout>
          <CustomerChatPage />
        </Layout>,
      )
    },

    async action(context) {
      let user = getCurrentUser()

      let validation = validateMessage(context.formData)
      if (!validation.ok) {
        let errorMsg: string
        if (validation.error === 'too_long') {
          errorMsg = `Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`
        } else if (validation.error === 'bad_thread_id') {
          errorMsg = 'Ungültiges Thread-ID-Format.'
        } else {
          errorMsg = 'Bitte gib eine Nachricht ein.'
        }
        return sseErrorResponse(errorMsg, 400)
      }

      let message = validation.message
      let threadId = validation.threadId

      if (!chatRateLimiter.attempt(user.id)) {
        return sseErrorResponse(
          'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.',
          429,
        )
      }

      if (!threadId) {
        threadId = crypto.randomUUID()
      }

      let body = new ReadableStream({
        start: async (controller) => {
          let agent = resolveCustomerAgent()
          let abortController = new AbortController()
          let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

          try {
            let output = await runWithUserId(user.id, () =>
              agent.stream(message, {
                maxSteps: 10,
                abortSignal: abortController.signal,
                memory: {
                  thread: threadId!,
                  resource: String(user.id),
                },
              }),
            )

            await recordChatRun({ runId: output.runId, userId: user.id, threadId: threadId! })

            controller.enqueue(sseEvent('start', { runId: output.runId, threadId }))

            await pipeStream(
              output.fullStream as ReadableStream,
              controller,
              abortController.signal,
              output.runId,
            )
            clearTimeout(timeout)
          } catch (err) {
            clearTimeout(timeout)
            let msg = sanitizeLog(err instanceof Error ? err.message : String(err))
            chatLog.error('action error:', msg)
            try {
              controller.enqueue(sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung.' }))
            } catch {
              /* already closed */
            }
            safeClose(controller)
          }
        },
      })

      return new Response(body, { headers: sseHeaders() })
    },

    async approve(context) {
      let user = getCurrentUser()
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return sseErrorResponse('Fehlende runId', 400)
      }

      let owner = await findChatRunOwner(runId)
      if (!owner || owner.userId !== user.id) {
        return new Response('Forbidden', { status: 403 })
      }

      return toolDecisionStream({
        runId,
        userId: user.id,
        threadId: owner.threadId,
        decision: 'approve',
        toolCallId,
        signal: context.request.signal,
      })
    },

    async decline(context) {
      let user = getCurrentUser()
      let runId = context.formData.get('runId')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined

      if (!runId) {
        return sseErrorResponse('Fehlende runId', 400)
      }

      let owner = await findChatRunOwner(runId)
      if (!owner || owner.userId !== user.id) {
        return new Response('Forbidden', { status: 403 })
      }

      return toolDecisionStream({
        runId,
        userId: user.id,
        threadId: owner.threadId,
        decision: 'decline',
        toolCallId,
        signal: context.request.signal,
      })
    },

    async answer(context) {
      let user = getCurrentUser()

      let runId = context.formData.get('runId')?.toString()
      let answerRaw = context.formData.get('answer')?.toString()
      let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
      let selectionMode = context.formData.get('selectionMode')?.toString()

      if (!runId || !answerRaw) {
        return sseErrorResponse('Fehlende runId oder Antwort', 400)
      }

      if (answerRaw.length > MAX_MESSAGE_LENGTH) {
        return sseErrorResponse(`Antwort zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen)`, 400)
      }

      let owner = await findChatRunOwner(runId)
      if (!owner || owner.userId !== user.id) {
        return new Response('Forbidden', { status: 403 })
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
            let agent = resolveCustomerAgent()
            let output = await runWithUserId(user.id, () =>
              agent.resumeStream(resumeData, { runId, toolCallId }),
            )

            controller.enqueue(
              sseEvent('start', {
                runId: output.runId,
                threadId: context.formData.get('threadId')?.toString() ?? owner.threadId,
              }),
            )

            if (output.runId !== runId) {
              await recordChatRun({
                runId: output.runId,
                userId: user.id,
                threadId: owner.threadId,
              })
              await clearChatRun(runId)
            }

            await pipeStream(
              output.fullStream as ReadableStream,
              controller,
              context.request.signal,
              output.runId,
            )
            try {
              controller.enqueue(sseEvent('complete', {}))
            } catch {
              /* already closed/sent */
            }
          } catch (err) {
            chatLog.error('answer error:', sanitizeLog(String(err)))
            try {
              controller.enqueue(
                sseEvent('agent-error', { error: 'Fehler bei der Antwortverarbeitung.' }),
              )
            } catch {
              /* already closed */
            }
            safeClose(controller)
          }
        },
      })

      return new Response(body, { headers: sseHeaders() })
    },
  },
})
