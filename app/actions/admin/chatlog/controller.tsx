import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import type { Database } from 'remix/data-table'

import { logAdminAction } from '../../../data/audit-log.ts'
import { users } from '../../../data/schema.ts'
import {
  classifyThreadSourceFor,
  countThreadsBySource,
  matchesSourceFilter,
  parseSourceFilter,
  type ChatlogSourceFilter,
} from '../../../data/chatlog-sources.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { fragmentResponseInit } from '../../../utils/fragment-response.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getAdminIdentity, getCurrentUser } from '../../../utils/context.ts'
import { getPageSize, getPageSizeOverride, PAGE_SIZE_KEYS } from '../../../utils/get-page-size.ts'
import { getSafeReturnTo } from '../../../utils/redirect.ts'
import { hasActiveChatRunForThread } from '../../chat/run-store.ts'
import { ChatLogPage } from '../../../ui/admin-chatlog-page.tsx'
import { ChatlogDetailFragment } from '../../../ui/admin-fragments/chatlog-detail-fragment.tsx'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { mastra } from '../../../actions/mastra/index.ts'
import {
  recallChatMessages,
  listAllChatThreads,
  getChatThread,
  deleteChatThread,
  reassignChatThread,
  fetchChatThreadPreviews,
  toAgentHandle,
  type ChatThreadPreview,
  type ChatThreadSummary,
} from '../../../utils/mastra-memory.ts'
import { validateThreadId } from '../../../utils/thread-id.ts'
import { chatlogQuery } from '../../../utils/chatlog-query.ts'
import type { ChatMessage } from '../../../types/chatlog.ts'

const CHATLOG_PAGE_SIZE = 10

const EMPTY_SOURCE_COUNTS: Record<ChatlogSourceFilter, number> = {
  all: 0,
  support: 0,
  customer: 0,
  legacy: 0,
}

/** Clamps a query/form offset to a non-negative integer. */
function parseOffset(raw: string | null | undefined): number {
  let value = Number(raw ?? '')
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * Parses the `detail` query parameter — the thread whose transcript the master
 * view should open on the right. Invalid or missing ids simply leave the pane
 * collapsed instead of failing the page.
 */
function parseSelectedId(raw: string | null | undefined): string | undefined {
  return raw && validateThreadId(raw) ? raw : undefined
}

/** Entry URL that resumes a saved support conversation in the chat surface. */
function supportAgentThreadHref(threadId: string): string {
  return routes.admin.supportAgent.index.href() + '?threadId=' + encodeURIComponent(threadId)
}

/** Numeric owner id from a thread's resource, or undefined for a legacy placeholder. */
function resourceUserId(resourceId: string): number | undefined {
  return /^\d+$/.test(resourceId) ? Number(resourceId) : undefined
}

/**
 * Whether a thread belongs to a different admin account.
 *
 * Source classification alone cannot tell another admin's support thread from a
 * customer thread — both are numeric ids. Adoption resolves the `users` row: a
 * customer (or a deleted owner with no row) is claimable, another admin's
 * support conversation is not. Legacy non-numeric placeholders have no owner and
 * are claimable.
 */
async function isOtherAdminsThread(
  db: Database,
  resourceId: string,
  currentUserId: number,
): Promise<boolean> {
  let ownerId = resourceUserId(resourceId)
  if (ownerId === undefined || ownerId === currentUserId) return false
  let owner = await db.findOne(users, { where: { id: ownerId } })
  return owner?.role === 'admin'
}

// ── Test seams ──────────────────────────────────────────────────
//
// The real chatlog reads Mastra memory. Tests inject a bounded set of thread
// summaries, previews, and a single-thread lookup so classification, filtering,
// pagination, and the continue link can be exercised deterministically. Outside
// test env the setter is a no-op (mirrors __setTestAgent / __setTestResumeResolver).
interface ChatlogTestFixtures {
  threads?: ChatThreadSummary[]
  previews?: Map<string, ChatThreadPreview>
  threadLookup?: (
    threadId: string,
  ) => Promise<{ resourceId: string; messages: ChatMessage[] } | null>
  reassign?: (threadId: string, resourceId: string) => Promise<void>
}

let _testFixtures: ChatlogTestFixtures | undefined
export function __setTestChatlogFixtures(fixtures: ChatlogTestFixtures | undefined) {
  if (process.env.NODE_ENV === 'test') _testFixtures = fixtures
}

async function loadAllThreads(): Promise<ChatThreadSummary[]> {
  if (process.env.NODE_ENV === 'test' && _testFixtures?.threads) return _testFixtures.threads
  let agent = toAgentHandle(mastra.getAgent('supportAgent'))
  return listAllChatThreads(agent)
}

async function loadPreviews(threadIds: string[]): Promise<Map<string, ChatThreadPreview>> {
  if (process.env.NODE_ENV === 'test' && _testFixtures?.previews) return _testFixtures.previews
  let agent = toAgentHandle(mastra.getAgent('supportAgent'))
  return fetchChatThreadPreviews(agent, threadIds)
}

async function loadThreadSummary(threadId: string): Promise<ChatThreadSummary | null> {
  if (process.env.NODE_ENV === 'test' && _testFixtures?.threadLookup) {
    let lookup = await _testFixtures.threadLookup(threadId)
    if (!lookup) return null
    return { id: threadId, resourceId: lookup.resourceId, createdAt: 0, updatedAt: 0 }
  }
  let agent = toAgentHandle(mastra.getAgent('supportAgent'))
  return getChatThread(agent, threadId)
}

async function reassignThread(threadId: string, resourceId: string): Promise<void> {
  if (process.env.NODE_ENV === 'test' && _testFixtures?.reassign) {
    await _testFixtures.reassign(threadId, resourceId)
    return
  }
  let agent = toAgentHandle(mastra.getAgent('supportAgent'))
  await reassignChatThread(agent, threadId, resourceId)
}

async function loadThreadForFragment(
  threadId: string,
): Promise<{ resourceId: string; messages: ChatMessage[] } | null> {
  if (process.env.NODE_ENV === 'test' && _testFixtures?.threadLookup) {
    return _testFixtures.threadLookup(threadId)
  }
  let agent = toAgentHandle(mastra.getAgent('supportAgent'))
  let thread = await getChatThread(agent, threadId)
  if (!thread) return null
  let messages = await recallChatMessages(agent, threadId)
  return { resourceId: thread.resourceId, messages }
}

async function renderChatLogPage(
  context: Pick<AppContext, 'render' | 'session'>,
  offset: number,
  selectedId: string | undefined,
  source: ChatlogSourceFilter,
): Promise<Response> {
  let pageKey = PAGE_SIZE_KEYS.adminChatlog
  let effectivePageSize = getPageSize(context.session, CHATLOG_PAGE_SIZE, pageKey)
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let adminUserId = getCurrentUser().id

  try {
    // Mastra's listThreads only filters by an exact resourceId, so the source
    // filter and its counts come from one bounded sweep classified in memory.
    let allThreads = await loadAllThreads()
    let sourceCounts = countThreadsBySource(allThreads, adminUserId)
    let filtered = allThreads.filter((thread) =>
      matchesSourceFilter(thread.resourceId, adminUserId, source),
    )

    let page = Math.floor(offset / effectivePageSize)
    let start = page * effectivePageSize
    let pageThreads = filtered.slice(start, start + effectivePageSize)
    let hasMore = start + effectivePageSize < filtered.length

    let conversations = pageThreads.map((thread) => ({
      id: thread.id,
      created_at: thread.createdAt,
      updated_at: thread.updatedAt,
      preview: '',
      previewFull: '',
      messageCount: 0,
      source: classifyThreadSourceFor(thread.resourceId, adminUserId),
    }))

    // Enrich each row with a text preview of the conversation opening so the
    // list no longer has to display a bare UUID. Failing to build a preview is
    // non-fatal — the column falls back to a muted placeholder.
    let previews = new Map<string, ChatThreadPreview>()
    try {
      previews = await loadPreviews(conversations.map((c) => c.id))
    } catch (error) {
      if (process.env.NODE_ENV !== 'test')
        console.error('[Admin Chatlog] Error loading conversation previews: ' + String(error))
    }
    conversations = conversations.map((c) => ({
      ...c,
      preview: previews.get(c.id)?.preview ?? '',
      previewFull: previews.get(c.id)?.previewFull ?? '',
      messageCount: previews.get(c.id)?.messageCount ?? 0,
    }))

    return renderAdminPage(
      context.render,
      'chatlog',
      <ChatLogPage
        conversations={conversations}
        offset={offset}
        hasMore={hasMore}
        pageSize={effectivePageSize}
        prevOffset={Math.max(0, offset - effectivePageSize)}
        nextOffset={offset + effectivePageSize}
        pageKey={pageKey}
        pageSizeOverride={pageSizeOverride}
        selectedId={selectedId}
        source={source}
        sourceCounts={sourceCounts}
      />,
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'test')
      console.error('[Admin Chatlog] Error loading conversations: ' + String(error))
    return renderAdminPage(
      context.render,
      'chatlog',
      <ChatLogPage
        conversations={[]}
        offset={0}
        hasMore={false}
        pageSize={effectivePageSize}
        prevOffset={0}
        nextOffset={effectivePageSize}
        pageKey={pageKey}
        pageSizeOverride={pageSizeOverride}
        selectedId={selectedId}
        source={source}
        sourceCounts={EMPTY_SOURCE_COUNTS}
      />,
    )
  }
}

export const adminChatlog = createController(routes.admin.chatlog, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let selectedId = parseSelectedId(context.url.searchParams.get('detail'))
      let source = parseSourceFilter(context.url.searchParams.get('source'))
      return renderChatLogPage(context, offset, selectedId, source)
    },

    // The frame commits the POST delete form action path as its src after
    // submission; render the list so a reload of that path resolves instead of
    // 404ing on the POST-only delete route.
    async destroyResolve(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let selectedId = parseSelectedId(context.url.searchParams.get('detail'))
      let source = parseSourceFilter(context.url.searchParams.get('source'))
      return renderChatLogPage(context, offset, selectedId, source)
    },

    async destroy(context) {
      let { params } = context
      let id = params.id
      let offset = parseOffset(context.formData.get('_offset') as string | null)
      let source = parseSourceFilter(context.formData.get('_source') as string | null)
      let query = chatlogQuery(offset, source)

      if (!id || !validateThreadId(id)) {
        return redirect(routes.admin.chatlog.index.href() + query)
      }

      try {
        let agent = mastra.getAgent('supportAgent')
        await deleteChatThread(agent, id)
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Admin Chatlog] destroy failed for ' + id + ': ' + String(error))
        }
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        void logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'mastra_thread',
          target_id: id,
        })
      }

      return redirect(routes.admin.chatlog.index.href() + query)
    },

    /**
     * Adopts a customer/legacy conversation into the current admin's support
     * scope, then opens it in the support agent.
     *
     * The transcript is read-only for threads owned by a customer, so continuing
     * one needs an explicit ownership transfer: Mastra's
     * `updateThreadResourceId` moves the thread and all of its messages to the
     * admin's resource. Another admin's support thread is refused, and an
     * already-owned thread just redirects (idempotent double submit).
     *
     * POST only, and the caller navigates as a full document, so the redirect
     * leaves the admin frame behind for the support-agent page.
     */
    async claim(context) {
      let id = context.params.id
      let returnTo =
        getSafeReturnTo(context.formData.get('_return') as string | null) ??
        routes.admin.chatlog.index.href()

      if (!id || !validateThreadId(id)) {
        context.session.flash('error', 'Ungültige Konversation.')
        return redirect(returnTo, 303)
      }

      let userId = getCurrentUser().id
      try {
        let thread = await loadThreadSummary(id)
        if (!thread) {
          context.session.flash('error', 'Konversation nicht gefunden.')
          return redirect(returnTo, 303)
        }

        if (classifyThreadSourceFor(thread.resourceId, userId) !== 'support') {
          if (await isOtherAdminsThread(context.db, thread.resourceId, userId)) {
            context.session.flash(
              'error',
              'Diese Konversation gehört zu einem anderen Admin und kann nicht übernommen werden.',
            )
            return redirect(returnTo, 303)
          }
          if (await hasActiveChatRunForThread(id)) {
            context.session.flash(
              'error',
              'Diese Konversation wird gerade verwendet und kann erst nach dem Abschluss übernommen werden.',
            )
            return redirect(returnTo, 303)
          }

          await reassignThread(id, String(userId))

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            await logAdminAction(context.db, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'claim',
              target_type: 'mastra_thread',
              target_id: id,
              details: {
                from_resource_id: thread.resourceId,
                to_resource_id: String(userId),
              },
            })
          }
        }

        return redirect(supportAgentThreadHref(id), 303)
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Admin Chatlog] claim failed for ' + id + ': ' + String(error))
        }
        context.session.flash('error', 'Konversation konnte nicht übernommen werden.')
        return redirect(returnTo, 303)
      }
    },
  },
})

// ── Chatlog Fragments ──

export const adminChatlogFragments = createController(routes.admin.chatlog.fragments, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async detail(context) {
      let conversationId = context.params.id
      // The transcript is rendered in a nested detail frame on the list page.
      // `offset`/`source` let the dismiss control (and its no-JS fallback link)
      // come back to the same list page and filter.
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let source = parseSourceFilter(context.url.searchParams.get('source'))
      let closeHref = routes.admin.chatlog.index.href() + chatlogQuery(offset, source)

      if (!conversationId || !validateThreadId(conversationId)) {
        return context.render(
          <ChatlogDetailFragment
            conversationId=""
            messages={[]}
            error="Keine Konversation ausgewählt."
            closeHref={closeHref}
          />,
          fragmentResponseInit(),
        )
      }

      try {
        let lookup = await loadThreadForFragment(conversationId)
        if (!lookup) {
          return context.render(
            <ChatlogDetailFragment
              conversationId={conversationId}
              messages={[]}
              error="Konversation konnte nicht geladen werden."
              closeHref={closeHref}
              returnId={conversationId}
            />,
            fragmentResponseInit(),
          )
        }

        // Ownership is resolved server-side from the thread's own resource id.
        // The admin's own support conversations continue directly; customer and
        // legacy threads offer an explicit adoption step instead. Another
        // admin's support thread is read-only here.
        let userId = getCurrentUser().id
        let canContinue = classifyThreadSourceFor(lookup.resourceId, userId) === 'support'
        let canClaim =
          !canContinue &&
          !(await isOtherAdminsThread(context.db, lookup.resourceId, userId)) &&
          !(await hasActiveChatRunForThread(conversationId))

        return context.render(
          <ChatlogDetailFragment
            conversationId={conversationId}
            messages={lookup.messages}
            closeHref={closeHref}
            returnId={conversationId}
            continueHref={canContinue ? supportAgentThreadHref(conversationId) : undefined}
            claimAction={
              canClaim ? routes.admin.chatlog.claim.href({ id: conversationId }) : undefined
            }
            claimReturnTo={closeHref}
          />,
          fragmentResponseInit(),
        )
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error(
            '[Admin Chatlog] detail failed for ' + conversationId + ': ' + String(error),
          )
        }
        return context.render(
          <ChatlogDetailFragment
            conversationId={conversationId}
            messages={[]}
            error="Konversation konnte nicht geladen werden."
            closeHref={closeHref}
            returnId={conversationId}
          />,
          fragmentResponseInit(),
        )
      }
    },
  },
})
