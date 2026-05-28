import { createController } from 'remix/router'

import { lists } from '../data/schema.ts'
import { pool } from '../data/setup.ts'
import { adminRoutes as routes } from '../routes.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminListsPage } from '../ui/admin-lists-page.tsx'

const PAGE_LIMIT = 10

export default createController<typeof routes.admin.lists, AppContext>(routes.admin.lists, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let rows: any[]
      let hasMore: boolean

      if (filter) {
        // Truncate filter to 200 chars to prevent abuse
        if (filter.length > 200) filter = filter.slice(0, 200)
        let searchPattern = `%${filter}%`
        let result = await pool.query(
          `SELECT * FROM lists
           WHERE description ILIKE $1
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(list) item
                WHERE item->>'label' ILIKE $1
              )
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [searchPattern, PAGE_LIMIT + 1, offset],
        )
        // Parse BIGINT strings to numbers (pg returns BIGINT as string)
        rows = result.rows.map((row: Record<string, unknown>) => ({
          ...row,
          created_at: typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at,
          updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : row.updated_at,
        }))
        hasMore = rows.length > PAGE_LIMIT
        if (hasMore) rows.pop()
      } else {
        rows = await context.db.findMany(lists, {
          limit: PAGE_LIMIT + 1,
          offset,
          orderBy: [['created_at', 'desc']] as const,
        })
        hasMore = rows.length > PAGE_LIMIT
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
          prevOffset={Math.max(0, offset - PAGE_LIMIT)}
          nextOffset={offset + PAGE_LIMIT}
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

      // Preserve filter in redirect
      let filter = context.url.searchParams.get('filter')
      let offset = context.url.searchParams.get('offset')
      let params = new URLSearchParams()
      if (offset) params.set('offset', offset)
      if (filter) params.set('filter', filter)
      let qs = params.toString()

      return new Response(null, {
        status: 302,
        headers: { Location: routes.admin.lists.index.href() + (qs ? '?' + qs : '') },
      })
    },
  },
})
