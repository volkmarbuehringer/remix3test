import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { requireAuth } from '../../middleware/auth.ts'
import { mastra, getDurableCustomerAgent } from '../mastra/index.ts'
import { routes } from '../../routes.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { sseErrorResponse } from '../../utils/agent-sse.ts'
import { createAgentChat, validationErrorResponse } from '../../utils/agent-chat.ts'
import {
  createDurableAgentChat,
  toDurableChatAgent,
  type DurableChatAgent,
} from '../../utils/agent-chat-durable.ts'
import { recordChatRun, findChatRunOwner, clearChatRun, findLatestChatRun } from './run-store.ts'
import { chatGateStore, resolvePendingGate } from './gate-store.ts'
import { Layout } from '../../ui/layout.tsx'
import { CustomerChatPage } from '../../ui/customer-chat-page.tsx'
import { createLogger } from '../../utils/logger.ts'
import { sanitizeLog, validateMessage } from '../mastra/shared-agent.ts'
import type { TestAgent } from '../mastra/shared-agent.ts'
import {
  recallChatMessages,
  listLatestCustomerThread,
  getChatThread,
  toAgentHandle,
} from '../../utils/mastra-memory.ts'
import type { ChatMessage } from '../../types/chatlog.ts'

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

// Cap the transcript rehydrated by the index route: a long thread would
// otherwise SSR (and hydrate into the DOM) every stored message. The most
// recent turns are the ones worth resuming.
const CHAT_RESUME_MESSAGE_LIMIT = 50

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

// ── Durable-agent feature flag ─────────────────────────────────
//
// The durable path is opt-in until parity is proven; the hand-rolled engine in
// agent-chat.ts stays the fallback. Enable with CUSTOMER_CHAT_DURABLE=1.
let _testDurableChat: boolean | undefined
export function __setTestDurableChat(enabled: boolean | undefined) {
  if (process.env.NODE_ENV === 'test') {
    _testDurableChat = enabled
  }
}

export function useDurableCustomerChat(): boolean {
  if (process.env.NODE_ENV === 'test' && _testDurableChat !== undefined) return _testDurableChat
  let flag = process.env.CUSTOMER_CHAT_DURABLE
  return flag === '1' || flag === 'true'
}

// Test-only durable-agent injection point — setter is a no-op outside test env.
let _testDurableAgent: DurableChatAgent | undefined
export function __setTestDurableAgent(agent: typeof _testDurableAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testDurableAgent = agent
  }
}

function resolveDurableCustomerAgent(): DurableChatAgent {
  return process.env.NODE_ENV === 'test' && _testDurableAgent
    ? _testDurableAgent
    : toDurableChatAgent(getDurableCustomerAgent())
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
    let agent = toAgentHandle(resolveCustomerAgent())
    let threadId = await listLatestCustomerThread(agent, String(userId))
    if (!threadId) return { messages: [] }
    let messages = await recallChatMessages(agent, threadId, String(userId), {
      limit: CHAT_RESUME_MESSAGE_LIMIT,
    })
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
 * to reject a foreign resource at write time.
 */
async function isOwnedCustomerThread(userId: number, threadId: string): Promise<boolean> {
  try {
    let resourceId: string | null
    if (process.env.NODE_ENV === 'test' && _testThreadLookup) {
      resourceId = (await _testThreadLookup(threadId))?.resourceId ?? null
    } else {
      let agent = toAgentHandle(resolveCustomerAgent())
      resourceId = (await getChatThread(agent, threadId))?.resourceId ?? null
    }
    return resourceId === String(userId)
  } catch (err) {
    chatLog.error('thread ownership check failed:', sanitizeLog(String(err)))
    return false
  }
}

// The streaming, suspension-gate and resume lifecycle shared with the support
// surface lives in `app/utils/agent-chat.ts`; this controller is the route
// bindings, the customer's actor scope and the thread-ownership boundary.
const engine = createAgentChat({
  logPrefix: '[CustomerChat]',
  resolveAgent: resolveCustomerAgent,
  gateStore: chatGateStore,
  recordRun: (run) =>
    recordChatRun({ runId: run.runId, userId: run.ownerId, threadId: run.threadId }),
  clearRun: (runId) => clearChatRun(runId),
  authorizeRun: async (runId, ownerId) => {
    let owner = await findChatRunOwner(runId)
    return owner && owner.userId === ownerId ? { threadId: owner.threadId } : null
  },
  clearGateOn: 'settled',
  answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
})

// The durable path replaces the gate-store reconnect and the
// approve/decline/answer transport with `createDurableAgent`'s
// `observe()`/`detach()` and `resume()`. It shares the customer's actor scope
// and thread-ownership boundary with the fallback engine.
const durableEngine = createDurableAgentChat({
  logPrefix: '[CustomerChatDurable]',
  resolveAgent: resolveDurableCustomerAgent,
  recordRun: (run) =>
    recordChatRun({ runId: run.runId, userId: run.ownerId, threadId: run.threadId }),
  clearRun: (runId) => clearChatRun(runId),
  authorizeRun: async (runId, ownerId) => {
    let owner = await findChatRunOwner(runId)
    return owner && owner.userId === ownerId ? { threadId: owner.threadId } : null
  },
  findLatestRun: async (ownerId) => {
    let run = await findLatestChatRun(ownerId)
    return run ? { runId: run.runId, threadId: run.threadId } : null
  },
  // Durable agents accept only a boolean requireToolApproval, and `true` gates
  // every tool call — including read-only searches. The customer agent's
  // destructive tools already set tool-level `requireApproval`, so parity lives
  // there; see docs/mastra-agent-modernization.md §3.1.
  requireToolApproval: undefined,
  answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
})

/** Selects the durable engine when the flag/test seam enables it. */
function customerChatEngine() {
  return useDurableCustomerChat() ? durableEngine : engine
}

function isSseRequest(request: Request): boolean {
  return request.headers.get('X-Sse-Request') === '1'
}

interface DecisionFormContext {
  session: { flash(key: 'success' | 'error', value: string): void }
}

/**
 * Runs a native (no-JS) decision form submission.
 *
 * The engine always answers with an SSE stream, so drain it — which runs the
 * decision to completion or to the next suspension — then redirect back to the
 * chat page with a flash result (the guide 09 form-mutation shape). A drained
 * `agent-error` frame, a non-200 status or a thrown error becomes the error
 * flash rather than a silently dropped decision.
 */
async function completeDecisionForm(
  context: DecisionFormContext,
  run: () => Promise<Response>,
  message: { success: string; error: string },
): Promise<Response> {
  let failed = false
  try {
    let response = await run()
    if (response.status !== 200) {
      failed = true
    } else {
      let body = await response.text()
      failed = body.includes('event: agent-error')
    }
  } catch (err) {
    chatLog.error('decision form failed:', sanitizeLog(String(err)))
    failed = true
  }
  try {
    context.session.flash(failed ? 'error' : 'success', failed ? message.error : message.success)
  } catch (err) {
    chatLog.error('decision flash failed:', sanitizeLog(String(err)))
  }
  return redirect(routes.chat.index.href(), 303)
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

      // No-JS gate: a suspended tool decision or ask_user question is rendered
      // as a native form so the customer can resolve it without the stream
      // client. The ownership join drops a gate whose run already settled.
      let gate = fresh ? null : await resolvePendingGate(user.id)
      let pendingApproval =
        gate?.gateType === 'tool_decision'
          ? {
              runId: gate.runId,
              toolCallId: gate.toolCallId,
              threadId: gate.threadId,
              args: gate.args,
            }
          : null
      let suspendPayload = gate?.suspendPayload
      let pendingQuestion =
        gate?.gateType === 'question'
          ? {
              runId: gate.runId,
              toolCallId: gate.toolCallId,
              threadId: gate.threadId,
              question: String(suspendPayload?.question ?? 'Bitte beantworten Sie die Frage.'),
              options:
                (suspendPayload?.options as { label: string; description?: string }[] | null) ??
                null,
              selectionMode: String(suspendPayload?.selectionMode ?? 'single_select'),
            }
          : null

      return context.render(
        <Layout>
          <CustomerChatPage
            threadId={resume.threadId}
            messages={resume.messages}
            pendingApproval={pendingApproval}
            pendingQuestion={pendingQuestion}
          />
        </Layout>,
      )
    },

    async action(context) {
      let user = getCurrentUser()

      let validation = validateMessage(context.formData)
      if (!validation.ok) {
        return validationErrorResponse(validation.error)
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

      return customerChatEngine().messageStream({ context, actorId: user.id, message, threadId })
    },

    async approve(context) {
      let user = getCurrentUser()
      let decide = () =>
        customerChatEngine().toolDecision({
          context,
          actorId: user.id,
          decision: 'approve',
          runId: context.formData.get('runId')?.toString() || undefined,
          toolCallId: context.formData.get('toolCallId')?.toString() || undefined,
        })

      if (!isSseRequest(context.request)) {
        return completeDecisionForm(context, decide, {
          success: 'Aktion bestätigt.',
          error: 'Die Bestätigung konnte nicht verarbeitet werden.',
        })
      }
      return decide()
    },

    async decline(context) {
      let user = getCurrentUser()
      let decide = () =>
        customerChatEngine().toolDecision({
          context,
          actorId: user.id,
          decision: 'decline',
          runId: context.formData.get('runId')?.toString() || undefined,
          toolCallId: context.formData.get('toolCallId')?.toString() || undefined,
        })

      if (!isSseRequest(context.request)) {
        return completeDecisionForm(context, decide, {
          success: 'Aktion abgelehnt.',
          error: 'Die Entscheidung konnte nicht verarbeitet werden.',
        })
      }
      return decide()
    },

    async answer(context) {
      let user = getCurrentUser()
      // A real form posts one `answer` per selected option, so a multi_select
      // answer arrives as repeated fields; the engine expects a JSON array
      // string. Normalize here for both the SSE and the native transport.
      let answers = context.formData
        .getAll('answer')
        .map((value) => String(value))
        .filter((value) => value.length > 0)
      let selectionMode = context.formData.get('selectionMode')?.toString() || undefined
      let answer =
        answers.length === 0
          ? undefined
          : answers.length > 1 || selectionMode === 'multi_select'
            ? JSON.stringify(answers)
            : answers[0]

      let respond = () =>
        customerChatEngine().answer({
          context,
          actorId: user.id,
          runId: context.formData.get('runId')?.toString() || undefined,
          answer,
          toolCallId: context.formData.get('toolCallId')?.toString() || undefined,
          selectionMode,
        })

      if (!isSseRequest(context.request)) {
        return completeDecisionForm(context, respond, {
          success: 'Antwort gesendet.',
          error: 'Die Antwort konnte nicht verarbeitet werden.',
        })
      }
      return respond()
    },

    /**
     * Re-surfaces a gate that is still suspended after a reload / reconnect.
     *
     * The transcript rehydration only restores text, so without this a customer
     * who reloads while an ask_user question or tool approval is pending has no
     * way to resume the run — the page would show only the model's prose and
     * the normal composer would start a new turn instead.
     */
    async reconnect(context) {
      let user = getCurrentUser()
      return customerChatEngine().reconnect({ context, actorId: user.id })
    },
  },
})
