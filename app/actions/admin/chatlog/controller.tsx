import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../../data/audit-log.ts'
import { pool } from '../../../data/setup.ts'
import { deleteConversation, getAllConversations, getConversation } from '../../../lib/chatlog.ts'
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

const CHATLOG_MAX_FILTER_LENGTH = 200
const CHATLOG_PAGE_SIZE = 5

export const adminChatlog = createController<typeof routes.admin.chatlog, AppContext>(routes.admin.chatlog, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      try {
        let filter = context.url.searchParams.get('filter') ?? undefined
        if (filter && filter.length > CHATLOG_MAX_FILTER_LENGTH) {
          filter = filter.slice(0, CHATLOG_MAX_FILTER_LENGTH)
        }

        let rawType = context.url.searchParams.get('type')
        let type: 'chat' | 'agent' | undefined
        if (rawType === 'chat' || rawType === 'agent') {
          type = rawType
        }

        let effectivePageSize = getPageSize(context.session, CHATLOG_PAGE_SIZE)
        let rawPage = parseInt(context.url.searchParams.get('page') ?? '1', 10)
        let page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
        let offset = (page - 1) * effectivePageSize

        let allConversations = await getAllConversations(filter, effectivePageSize + 1, offset, type)

        let hasMore = allConversations.length > effectivePageSize
        let conversations = hasMore ? allConversations.slice(0, effectivePageSize) : allConversations

        return renderAdminPage(context.render, 'chatlog', <ChatLogPage conversations={conversations} filter={filter} type={type} page={page} hasMore={hasMore} />)
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') console.error('[Admin Chatlog] Error loading conversations: ' + String(error))
        return renderAdminPage(context.render, 'chatlog', <ChatLogPage conversations={[]} filter={undefined} type={undefined} page={1} hasMore={false} />)
      }
    },

    async destroy(context) {
      let { params } = context
      await deleteConversation(params.id)

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'chatlog',
          target_id: params.id,
        })
      }

      return redirect(routes.admin.chatlog.index.href())
    },
  },
})

// ── Chatlog Fragments ──

export const adminChatlogFragments = createController<typeof routes.admin.chatlog.fragments, AppContext>(
  routes.admin.chatlog.fragments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async detail(context) {
        let conversationId = context.params.id

        if (!conversationId) {
          return context.render(
            <ChatlogDetailFragment conversationId="" messages={[]} error="No conversation ID provided" />,
            fragmentResponseInit(),
          )
        }

        let chat = await getConversation(conversationId)

        if (!chat) {
          return context.render(
            <ChatlogDetailFragment conversationId={conversationId} messages={[]} error="Conversation not found" />,
            fragmentResponseInit(),
          )
        }

        return context.render(
          <ChatlogDetailFragment
            conversationId={chat.id}
            messages={chat.conversation}
          />,
          fragmentResponseInit(),
        )
      },
    },
  },
)
