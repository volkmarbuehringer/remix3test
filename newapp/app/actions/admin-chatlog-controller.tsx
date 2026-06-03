import { createController } from 'remix/router'
import { adminRoutes as routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'
import { redirect } from 'remix/response/redirect'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { deleteConversation, getAllConversations } from '../lib/chatlog.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { logAdminAction } from '../data/audit-log.ts'
import { pool } from '../data/setup.ts'
import { ChatLogPage } from '../ui/admin-chatlog-page.tsx'
import { getAdminIdentity } from '../utils/context.ts'

const MAX_FILTER_LENGTH = 200
const PAGE_SIZE = 5

export default createController<typeof routes.admin.chatlog, AppContext>(routes.admin.chatlog, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      try {
        let filter = context.url.searchParams.get('filter') ?? undefined
        if (filter && filter.length > MAX_FILTER_LENGTH) {
          filter = filter.slice(0, MAX_FILTER_LENGTH)
        }

        let rawType = context.url.searchParams.get('type')
        let type: 'chat' | 'agent' | undefined
        if (rawType === 'chat' || rawType === 'agent') {
          type = rawType
        }

        let rawPage = parseInt(context.url.searchParams.get('page') ?? '1', 10)
        let page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
        let offset = (page - 1) * PAGE_SIZE

        let allConversations = await getAllConversations(filter, PAGE_SIZE + 1, offset, type)

        let hasMore = allConversations.length > PAGE_SIZE
        let conversations = hasMore ? allConversations.slice(0, PAGE_SIZE) : allConversations

        return renderAdminPage(context.render, 'chatlog', <ChatLogPage conversations={conversations} filter={filter} type={type} page={page} hasMore={hasMore} />)
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') console.error('[Admin Chatlog] Error loading conversations:', error)
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
