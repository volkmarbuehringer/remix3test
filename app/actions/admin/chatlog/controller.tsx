import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../../data/audit-log.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { fragmentResponseInit } from '../../../middleware/render.tsx'
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
} from '../../../utils/mastra-memory.ts'
import { validateThreadId } from '../../../utils/thread-id.ts'
import type { ChatMessage } from '../../../types/chatlog.ts'

const CHATLOG_PAGE_SIZE = 5

export const adminChatlog = createController<typeof routes.admin.chatlog, AppContext>(
  routes.admin.chatlog,
  {
    middleware: [requireAuth(), requireAdmin()],
    actions: {
      async index(context) {
        try {
          let effectivePageSize = getPageSize(context.session, CHATLOG_PAGE_SIZE)
          let rawPage = parseInt(context.url.searchParams.get('page') ?? '1', 10)
          let page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

          let agent = mastra.getAgent('supportAgent')
          let { threads, hasMore } = await listChatThreads(agent, {
            page: page - 1,
            perPage: effectivePageSize,
          })

          let conversations = threads.map((t) => ({
            id: t.id,
            conversation: [] as ChatMessage[],
            created_at: t.createdAt,
            updated_at: t.updatedAt,
          }))

          return renderAdminPage(
            context.render,
            'chatlog',
            <ChatLogPage conversations={conversations} page={page} hasMore={hasMore} />,
          )
        } catch (error) {
          if (process.env.NODE_ENV !== 'test')
            console.error('[Admin Chatlog] Error loading conversations: ' + String(error))
          return renderAdminPage(
            context.render,
            'chatlog',
            <ChatLogPage conversations={[]} page={1} hasMore={false} />,
          )
        }
      },

      async destroy(context) {
        let { params } = context
        let id = params.id

        if (!id || !validateThreadId(id)) {
          return redirect(routes.admin.chatlog.index.href())
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

        return redirect(routes.admin.chatlog.index.href())
      },
    },
  },
)

// ── Chatlog Fragments ──

export const adminChatlogFragments = createController<
  typeof routes.admin.chatlog.fragments,
  AppContext
>(routes.admin.chatlog.fragments, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async detail(context) {
      let conversationId = context.params.id

      if (!conversationId || !validateThreadId(conversationId)) {
        return context.render(
          <ChatlogDetailFragment
            conversationId=""
            messages={[]}
            error="No conversation ID provided"
          />,
          fragmentResponseInit(),
        )
      }

      try {
        let agent = mastra.getAgent('supportAgent')
        let chatMessages = await recallChatMessages(agent, conversationId)

        return context.render(
          <ChatlogDetailFragment conversationId={conversationId} messages={chatMessages} />,
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
            error="Conversation not found"
          />,
          fragmentResponseInit(),
        )
      }
    },
  },
})
