import { createController } from 'remix/router'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes, frames } from '../../routes.ts'
import { mastra } from '../mastra/index.ts'
import { supportGateStore, resolvePendingGate } from './run-store.ts'
import { getCurrentUser, getAdminIdentity } from '../../utils/context.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import { recallChatMessages, getChatThread, type AgentHandle } from '../../utils/mastra-memory.ts'
import { classifyThreadSourceFor } from '../../data/chatlog-sources.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import type { ChatMessage } from '../../types/chatlog.ts'
import { sseErrorResponse } from '../../utils/agent-sse.ts'
import { createAgentChat, validationErrorResponse } from '../../utils/agent-chat.ts'
import { runWithAdminId } from '../mastra/tools/admin-context.ts'
import { sanitizeLog, validateMessage } from '../mastra/shared-agent.ts'

import { logAdminAction } from '../../data/audit-log.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import {
  SupportAgentEmptyState,
  SupportAgentPage,
  type SupportRecentThread,
} from '../../ui/support-agent-page.tsx'
import type { TestAgent } from '../mastra/shared-agent.ts'
import { fetchChatThreadPreviews, listChatThreadsForResource } from '../../utils/mastra-memory.ts'

const chatRateLimiter = createRateLimiter({ windowMs: 2000, perUser: true })

export { chatRateLimiter }

function getPanelTarget(_path: string): string {
  return frames.supportAgentPanel
}

// Test-only agent injection point — setter is a no-op outside test env
let _testAgent: TestAgent | undefined
export function __setTestAgent(agent: typeof _testAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}
function resolveAgent(): TestAgent {
  return process.env.NODE_ENV === 'test' && _testAgent
    ? _testAgent
    : mastra.getAgent('supportAgent')
}

// Injectable run-status resolver for the reconnect snapshot verification, so
// tests can stub Mastra storage (mirrors the agent-events __setRunStatusResolver
// seam). A PostgresStoreVNext agent-run-status query is not exposed, so the
// default reads the durable pending-gate row we write on suspension.
type RunStatusSnapshot = {
  status: string
  suspendPayload?: Record<string, unknown> | undefined
}
type RunStatusResolver = (adminUserId: number, runId: string) => Promise<RunStatusSnapshot | null>

async function defaultRunStatusResolver(
  adminUserId: number,
  runId: string,
): Promise<RunStatusSnapshot | null> {
  let row = await resolvePendingGate(adminUserId, runId)
  if (!row) return null
  return row.status === 'suspended'
    ? { status: 'suspended', suspendPayload: row.suspendPayload ?? undefined }
    : { status: 'running' }
}

let _runStatusResolver: RunStatusResolver = defaultRunStatusResolver
export function __setRunStatusResolver(fn: RunStatusResolver | undefined) {
  _runStatusResolver = fn ?? defaultRunStatusResolver
}

// ── Thread selection (?threadId=) ───────────────────────────────
//
// The index route can resume a specific saved support conversation. A test-only
// resolver seam mirrors __setTestResumeResolver in the customer chat controller:
// the mock agent has no real memory, so tests inject the selection outcome.
type SupportThreadResume = { threadId: string; messages: ChatMessage[] }

/** Raw memory read used by the index; the ownership check is applied after it. */
type SupportThreadLookup = { resourceId: string; messages: ChatMessage[] }

type SupportThreadResolver = (threadId: string) => Promise<SupportThreadLookup | null>

let _testThreadResolver: SupportThreadResolver | undefined
export function __setTestThreadResolver(fn: SupportThreadResolver | undefined) {
  if (process.env.NODE_ENV === 'test') _testThreadResolver = fn
}

/**
 * Resolves a requested thread for the support agent, or null when it must not
 * be opened. The id is validated for format and then for ownership: only a
 * thread whose resource is this admin's own user id can be continued. Every
 * failure (malformed, unknown, foreign, or a memory error) degrades to an empty
 * conversation rather than an error page.
 */
async function resolveSupportThread(
  userId: number,
  requested: string | null | undefined,
): Promise<SupportThreadResume | null> {
  if (!requested || !validateThreadId(requested)) return null

  try {
    let lookup: SupportThreadLookup | null
    if (process.env.NODE_ENV === 'test' && _testThreadResolver) {
      lookup = await _testThreadResolver(requested)
    } else {
      let agent = resolveAgent() as unknown as AgentHandle
      let thread = await getChatThread(agent, requested)
      lookup = thread
        ? {
            resourceId: thread.resourceId,
            messages: await recallChatMessages(agent, requested, String(userId)),
          }
        : null
    }

    if (!lookup) return null
    // Ownership: only the admin's own support conversations may be resumed.
    if (classifyThreadSourceFor(lookup.resourceId, userId) !== 'support') return null

    return { threadId: requested, messages: lookup.messages }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(
        '[SupportAgentChat] thread selection failed: ' +
          sanitizeLog(err instanceof Error ? err.message : String(err)),
      )
    }
    return null
  }
}

/**
 * Whether a supplied thread id exists and is owned by this admin.
 *
 * The index validates ownership before it opens a transcript, but the message
 * action is a separate write path: a direct POST (or a client re-sending a URL
 * id) can supply one. Checking here too keeps the boundary in the application
 * instead of relying on the memory store to reject a foreign resource at write
 * time.
 */
async function isOwnedSupportThread(
  userId: number,
  threadId: string,
  log: (...args: unknown[]) => void,
): Promise<boolean> {
  try {
    let resourceId: string | null
    if (process.env.NODE_ENV === 'test' && _testThreadResolver) {
      let lookup = await _testThreadResolver(threadId)
      resourceId = lookup?.resourceId ?? null
    } else {
      let agent = resolveAgent() as unknown as AgentHandle
      let thread = await getChatThread(agent, threadId)
      resourceId = thread?.resourceId ?? null
    }
    return resourceId !== null && classifyThreadSourceFor(resourceId, userId) === 'support'
  } catch (err) {
    log('ownership check failed: ' + sanitizeLog(err instanceof Error ? err.message : String(err)))
    return false
  }
}

// ── Recent conversations (fresh page quick-resume) ────────────────────
//
// The index offers the admin's own most recent support conversations for quick
// resume. A test-only resolver seam mirrors __setTestThreadResolver so tests can
// stub Mastra memory.
type SupportRecentThreadsResolver = () => Promise<SupportRecentThread[]>

let _testRecentThreadsResolver: SupportRecentThreadsResolver | undefined
export function __setTestRecentThreadsResolver(fn: SupportRecentThreadsResolver | undefined) {
  if (process.env.NODE_ENV === 'test') _testRecentThreadsResolver = fn
}

async function resolveRecentSupportThreads(
  userId: number,
  log: (...args: unknown[]) => void,
): Promise<SupportRecentThread[]> {
  if (process.env.NODE_ENV === 'test') {
    return _testRecentThreadsResolver ? _testRecentThreadsResolver() : []
  }
  try {
    let agent = resolveAgent() as unknown as AgentHandle
    let threads = await listChatThreadsForResource(agent, String(userId), { perPage: 8 })
    if (threads.length === 0) return []
    let previews = await fetchChatThreadPreviews(
      agent,
      threads.map((t) => t.id),
    )
    return threads.map((t) => ({
      threadId: t.id,
      title: previews.get(t.id)?.preview || 'Unterhaltung',
    }))
  } catch (err) {
    log('recent threads failed: ' + sanitizeLog(err instanceof Error ? err.message : String(err)))
    return []
  }
}

// The streaming, suspension-gate and resume lifecycle shared with the customer
// surface lives in `app/utils/agent-chat.ts`. This surface adds the admin actor
// scope, the support-panel frame target, the run-status reconnect verification
// and the audit-log side effects.
const engine = createAgentChat({
  logPrefix: '[SupportAgentChat]',
  resolveAgent: resolveAgent,
  gateStore: supportGateStore,
  runWithActor: (actorId, fn) => runWithAdminId(actorId, fn),
  getTarget: getPanelTarget,
  clearGateOn: 'complete-or-error',
  verifyRunStatus: (ownerId, runId) => _runStatusResolver(ownerId, runId),
  answerErrorMessage: 'Fehler beim Fortsetzen des Agents.',
})

function logFor(
  logger: ((message: string) => void) | undefined,
  userId: number,
  tag: string,
): (...args: unknown[]) => void {
  return (...args: unknown[]) =>
    logger?.(
      `[SupportAgentChat]${tag ? ` [${tag}]` : ''} [user:${userId}] ${args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')}`,
    )
}

export const supportAgentChat = createController(routes.admin.supportAgent, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async panel(context) {
      return context.render(<SupportAgentEmptyState />)
    },

    async index(context) {
      let user = getCurrentUser()
      let log = logFor(context.logger, user.id, '')

      // A full-document GET renders the admin shell, whose admin-content frame
      // then re-fetches this same URL for the page content. Only that frame
      // request renders SupportAgentPage, so only it needs the transcript
      // recall; loading it on the shell pass would read memory twice.
      let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
      let resume: SupportThreadResume | null = null
      let recentThreads: SupportRecentThread[] = []
      if (isFrameRequest) {
        resume = await resolveSupportThread(user.id, context.url.searchParams.get('threadId'))
        // The recent list only serves the fresh page; a resumed transcript
        // already shows the conversation, so skip the extra memory reads.
        if (!resume) recentThreads = await resolveRecentSupportThreads(user.id, log)
      }

      return renderAdminPage(
        context.render,
        'support',
        <SupportAgentPage
          threadId={resume?.threadId}
          messages={resume?.messages ?? []}
          recentThreads={recentThreads}
        />,
      )
    },

    async action(context) {
      let user = getCurrentUser()
      let log = logFor(context.logger, user.id, '')

      log('POST action start')

      let validation = validateMessage(context.formData)
      if (!validation.ok) {
        log('validation failed: ' + validation.error)
        return validationErrorResponse(validation.error)
      }

      let message = validation.message
      let threadId = validation.threadId

      if (!chatRateLimiter.attempt(user.id)) {
        log('rate limited')
        return sseErrorResponse(
          'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.',
          429,
        )
      }

      // The index only opens a thread the admin owns, but this action is a
      // separate path. Enforce the same ownership before the id reaches memory
      // so a direct POST (or a client re-sending a URL id) can never write into
      // a conversation the admin does not own.
      if (threadId && !(await isOwnedSupportThread(user.id, threadId, log))) {
        log('ignoring thread not owned by this admin: ' + sanitizeLog(threadId))
        threadId = undefined
      }

      if (!threadId) {
        threadId = crypto.randomUUID()
        log('new mastra thread created: ' + sanitizeLog(threadId))
      } else {
        log('continuing thread: ' + sanitizeLog(threadId))
      }

      return engine.messageStream({
        context,
        actorId: user.id,
        message,
        threadId,
        onSettled: () => {
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
        },
      })
    },

    async toolDecision(context) {
      let user = getCurrentUser()
      let log = logFor(context.logger, user.id, 'toolDecision')

      if (!chatRateLimiter.attempt(user.id)) {
        log('rate limited')
        return sseErrorResponse('Bitte warte einen Moment.', 429)
      }

      let decision = context.formData.get('decision')?.toString()
      if (decision !== 'approve' && decision !== 'decline') {
        return sseErrorResponse('decision muss "approve" oder "decline" sein', 400)
      }

      log('tool decision: ' + decision)

      return engine.toolDecision({
        context,
        actorId: user.id,
        decision,
        runId: context.formData.get('runId')?.toString() || undefined,
        toolCallId: context.formData.get('toolCallId')?.toString() || undefined,
        threadId: context.formData.get('threadId')?.toString() || undefined,
        onDecision: (runId) => {
          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(context.db, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'support_tool_approval',
              target_type: 'mastra_tool_call',
              target_id: runId,
            })
          }
        },
      })
    },

    async answer(context) {
      let user = getCurrentUser()

      if (!chatRateLimiter.attempt(user.id)) {
        return sseErrorResponse('Bitte warte einen Moment.', 429)
      }

      return engine.answer({
        context,
        actorId: user.id,
        runId: context.formData.get('runId')?.toString() || undefined,
        answer: context.formData.get('answer')?.toString() || undefined,
        toolCallId: context.formData.get('toolCallId')?.toString() || undefined,
        selectionMode: context.formData.get('selectionMode')?.toString() || undefined,
        threadId: context.formData.get('threadId')?.toString() || undefined,
      })
    },

    async reconnect(context) {
      let user = getCurrentUser()
      return engine.reconnect({ context, actorId: user.id })
    },
  },
})
