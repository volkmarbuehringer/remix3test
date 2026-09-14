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
import {
  recallChatMessages,
  listLatestCustomerThread,
  getChatThread,
} from '../../utils/mastra-memory.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import type { AgentHandle } from '../../utils/mastra-memory.ts'

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

// ── Conversation resume ────────────────────────────────────────
type CustomerResume = { threadId?: string; messages: ChatMessage[] }

// Test-only override for the index route's resume lookup (the mock agent has no
// real memory). Outside test env this is unused.
let _testResume: ((userId: number) => Promise<CustomerResume>) | undefined
export function __setTestResumeResolver(fn: typeof _testResume) {
  if (process.env.NODE_ENV === 'test') {
    _testResume = fn
  }
}

/**
 * Resolves the most recent conversation for a customer so the index route can
 * rehydrate it. Failure (including a test agent with no memory) simply yields an
 * empty resume — the page renders a fresh conversation rather than erroring.
 */
async function resolveCustomerResume(userId: number): Promise<CustomerResume> {
  if (process.env.NODE_ENV === 'test' && _testResume) {
    return _testResume(userId)
  }
  try {
    let agent = resolveCustomerAgent() as unknown as AgentHandle
    let threadId = await listLatestCustomerThread(agent, String(userId))
    if (!threadId) return { messages: [] }
    let messages = await recallChatMessages(agent, threadId, String(userId))
    return { threadId, messages }
  } catch (err) {
    chatLog.error('resume error:', sanitizeLog(String(err)))
    return { messages: [] }
  }
}

// ── Thread ownership (write path) ──────────────────────────────
type CustomerThreadLookup = { resourceId: string }

// Test-only lookup so the mock agent (no getMemory) can report a thread's
// owning resource. Outside test env this is unused.
let _testThreadLookup: ((threadId: string) => Promise<CustomerThreadLookup | null>) | undefined
export function __setTestThreadLookup(fn: typeof _testThreadLookup) {
  if (process.env.NODE_ENV === 'test') {
    _testThreadLookup = fn
  }
}

/**
 * Whether a supplied thread id exists and belongs to this customer.
 *
 * The index route only opens a thread the customer owns, but the message action
 * is a separate write path: a direct POST can name any thread. Checking here
 * keeps the boundary in the application instead of relying on the memory store
 * to reject a foreign resource at write time (mirrors the support agent's
 * isOwnedSupportThread).
 */
async function isOwnedCustomerThread(userId: number, threadId: string): Promise<boolean> {
  try {
    let resourceId: string | null
    if (process.env.NODE_ENV === 'test' && _testThreadLookup) {
      resourceId = (await _testThreadLookup(threadId))?.resourceId ?? null
    } else {
      let agent = resolveCustomerAgent() as unknown as AgentHandle
      resourceId = (await getChatThread(agent, threadId))?.resourceId ?? null
    }
    return resourceId === String(userId)
  } catch (err) {
    chatLog.error('thread ownership check failed:', sanitizeLog(String(err)))
    return false
  }
}

type ResumeResult = {
  text?: string
  finishReason?: string
  runId?: string
  suspendPayload?: Record<string, unknown>
  fullStream?: unknown
}

type StreamEndReason = 'complete' | 'suspended' | 'error' | 'aborted'

/**
 * pipeStream hooks for a durable-index flow.
 *
 * The shared filter only stops its read loop at a tool-approval suspension when
 * an `onSuspension` hook is supplied, so passing one makes the approval gate
 * terminal for this stream. `onEnd` reports whether the run actually settled or
 * suspended, so the caller can keep the ownership row for a suspended run and
 * clear it only once the run is truly done.
 */
function terminalHooks(onEnd: (reason: StreamEndReason) => void) {
  return { onSuspension: () => {}, onEnd }
}

/**
 * Whether a settled reason means the ownership row can be dropped. Passed
 * through a function so TypeScript does not narrow the caller's variable to its
 * initial literal across the pipeStream callback.
 */
function isSettledRun(reason: StreamEndReason): boolean {
  return reason !== 'suspended'
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
  toolCallId?: string | undefined
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
            ? agent.approveToolCallGenerate({
                runId,
                ...(toolCallId !== undefined ? { toolCallId } : {}),
              })
            : agent.declineToolCallGenerate({
                runId,
                ...(toolCallId !== undefined ? { toolCallId } : {}),
              }),
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

        let endReason: StreamEndReason = 'complete'
        if (result.fullStream) {
          let contRunId = result.runId || runId
          if (contRunId !== runId) {
            await recordChatRun({ runId: contRunId, userId, threadId })
          }
          await pipeStream(
            result.fullStream as ReadableStream,
            controller,
            signal,
            contRunId,
            undefined,
            terminalHooks((reason) => {
              endReason = reason
            }),
          )
        } else {
          let text = (
            result.text || (decision === 'approve' ? '' : 'Die Aktion wurde abgelehnt.')
          ).trim()
          if (text) controller.enqueue(sseEvent('message', { text }))
          controller.enqueue(sseEvent('complete', {}))
          controller.close()
        }

        // Terminal resolution — a settled run no longer needs an ownership
        // pointer, but a re-suspended one must keep it or the next decision is a
        // false 403 (see mastra-durable-run-ownership).
        if (isSettledRun(endReason)) {
          await clearChatRun(runId)
          if (result.runId && result.runId !== runId) await clearChatRun(result.runId)
        }
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
      let user = getCurrentUser()

      // A fresh-conversation reload (`/chat?new=1`) skips resurrection so the
      // customer can start over; otherwise rehydrate the most recent thread.
      let fresh = context.url.searchParams.get('new') === '1'
      let resume: CustomerResume = { messages: [] }
      if (!fresh) {
        resume = await resolveCustomerResume(user.id)
      }

      return context.render(
        <Layout>
          <CustomerChatPage threadId={resume.threadId} messages={resume.messages} />
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

      // The index route only resumes a thread the customer owns, but this
      // action is a separate write path: a direct POST (or a client re-sending
      // a stale id) can supply any thread. Enforce ownership before the id
      // reaches memory so it can never write into another customer's
      // conversation, then fall back to a fresh thread.
      if (threadId && !(await isOwnedCustomerThread(user.id, threadId))) {
        chatLog('ignoring thread not owned by this customer:', sanitizeLog(threadId))
        threadId = undefined
      }

      if (!threadId) {
        threadId = crypto.randomUUID()
      }

      let body = new ReadableStream({
        start: async (controller) => {
          let agent = resolveCustomerAgent()
          let abortController = new AbortController()
          let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)
          let endReason: StreamEndReason = 'complete'

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
              undefined,
              terminalHooks((reason) => {
                endReason = reason
              }),
            )
            clearTimeout(timeout)

            // A settled run no longer needs an ownership pointer; a suspended
            // one must keep it or the next approve/decline/answer is a false
            // 403 (see mastra-durable-run-ownership).
            if (isSettledRun(endReason)) {
              await clearChatRun(output.runId)
            }
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
          let endReason: StreamEndReason = 'complete'
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
              undefined,
              terminalHooks((reason) => {
                endReason = reason
              }),
            )

            // A settled continuation can drop its pointer; a re-suspended one
            // must keep it (see mastra-durable-run-ownership).
            if (isSettledRun(endReason)) {
              await clearChatRun(output.runId)
            }

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
