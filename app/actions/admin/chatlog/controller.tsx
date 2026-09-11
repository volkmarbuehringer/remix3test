import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../../data/audit-log.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { fragmentResponseInit } from '../../../utils/fragment-response.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { ChatLogPage } from '../../../ui/admin-chatlog-page.tsx'
import { ChatlogDetailFragment } from '../../../ui/admin-fragments/chatlog-detail-fragment.tsx'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { mastra } from '../../../actions/mastra/index.ts'
import {
  recallChatMessages,
  listChatThreads,
  deleteChatThread,
  fetchChatThreadPreviews,
  type ChatThreadPreview,
} from '../../../utils/mastra-memory.ts'
import { validateThreadId } from '../../../utils/thread-id.ts'

const CHATLOG_PAGE_SIZE = 10

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

async function renderChatLogPage(
  context: Pick<AppContext, 'render' | 'session'>,
  offset: number,
  selectedId: string | undefined,
): Promise<Response> {
  let effectivePageSize = getPageSize(context.session, CHATLOG_PAGE_SIZE)

  try {
    let page = Math.floor(offset / effectivePageSize)

    let agent = mastra.getAgent('supportAgent')
    let { threads, hasMore } = await listChatThreads(agent, {
      page,
      perPage: effectivePageSize,
    })

    let conversations = threads.map((t) => ({
      id: t.id,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      preview: '',
      previewFull: '',
    }))

    // Enrich each row with a text preview of the conversation opening so the
    // list no longer has to display a bare UUID. Failing to build a preview is
    // non-fatal — the column falls back to a muted placeholder.
    let previews = new Map<string, ChatThreadPreview>()
    try {
      previews = await fetchChatThreadPreviews(
        agent,
        conversations.map((c) => c.id),
      )
    } catch (error) {
      if (process.env.NODE_ENV !== 'test')
        console.error('[Admin Chatlog] Error loading conversation previews: ' + String(error))
    }
    conversations = conversations.map((c) => ({
      ...c,
      preview: previews.get(c.id)?.preview ?? '',
      previewFull: previews.get(c.id)?.previewFull ?? '',
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
        selectedId={selectedId}
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
        selectedId={selectedId}
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
      return renderChatLogPage(context, offset, selectedId)
    },

    // The frame commits the POST delete form action path as its src after
    // submission; render the list so a reload of that path resolves instead of
    // 404ing on the POST-only delete route.
    async destroyResolve(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let selectedId = parseSelectedId(context.url.searchParams.get('detail'))
      return renderChatLogPage(context, offset, selectedId)
    },

    async destroy(context) {
      let { params } = context
      let id = params.id
      let offset = parseOffset(context.formData.get('_offset') as string | null)
      let qs = offset > 0 ? `?offset=${offset}` : ''

      if (!id || !validateThreadId(id)) {
        return redirect(routes.admin.chatlog.index.href() + qs)
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
        logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'mastra_thread',
          target_id: id,
        })
      }

      return redirect(routes.admin.chatlog.index.href() + qs)
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
      // `offset`/`returnId` let the dismiss control (and its no-JS fallback
      // link) come back to the same list page and row.
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let closeHref = routes.admin.chatlog.index.href() + (offset > 0 ? `?offset=${offset}` : '')

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
        let agent = mastra.getAgent('supportAgent')
        let chatMessages = await recallChatMessages(agent, conversationId)

        return context.render(
          <ChatlogDetailFragment
            conversationId={conversationId}
            messages={chatMessages}
            closeHref={closeHref}
            returnId={conversationId}
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
