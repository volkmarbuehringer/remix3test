import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../../data/audit-log.ts'
import { lists } from '../../../data/schema.ts'
import { searchLists } from '../../../data/admin-lists.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminListsPage } from '../../../ui/admin-lists-page.tsx'
import { getPageSize } from '../../../utils/get-page-size.ts'

const LISTS_PAGE_LIMIT = 10

export const adminLists = createController<typeof routes.admin.lists, AppContext>(routes.admin.lists, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let effectivePageSize = getPageSize(context.session, LISTS_PAGE_LIMIT)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let rows: Array<Record<string, unknown>>
      let hasMore: boolean

      if (filter) {
        if (filter.length > 200) filter = filter.slice(0, 200)
        let esc = filter.replace(/[%_\\]/g, '\\$&')
        let searchPattern = `%${esc}%`
        rows = await searchLists(context.db, searchPattern, effectivePageSize + 1, offset)
        hasMore = rows.length > effectivePageSize
        if (hasMore) rows.pop()
      } else {
        rows = await context.db.findMany(lists, {
          limit: effectivePageSize + 1,
          offset,
          orderBy: [['created_at', 'desc']] as const,
        })
        hasMore = rows.length > effectivePageSize
        if (hasMore) rows.pop()
      }

      return renderAdminPage(
        context.render,
        'lists',
        <AdminListsPage
          lists={rows as any[]}
          offset={offset}
          hasMore={hasMore}
          filter={filter}
          prevOffset={Math.max(0, offset - effectivePageSize)}
          nextOffset={offset + effectivePageSize}
        />,
      )
    },

    async destroy(context) {
      let db = context.db
      let listId = Number(context.params.id)

      if (!Number.isFinite(listId) || !Number.isInteger(listId) || listId < 1) {
        return new Response('Invalid list ID', { status: 400 })
      }

      await db.delete(lists, { id: listId })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'lists',
          target_id: listId,
        })
      }

      let filter = context.url.searchParams.get('filter')
      let offset = context.url.searchParams.get('offset')
      let params = new URLSearchParams()
      if (offset) params.set('offset', offset)
      if (filter) params.set('filter', filter)
      let qs = params.toString()

      return redirect(routes.admin.lists.index.href() + (qs ? '?' + qs : ''))
    },
  },
})
