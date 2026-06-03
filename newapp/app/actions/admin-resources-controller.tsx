import { createController } from 'remix/router'
import { ilike } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { verwaltungRoutes as routes } from '../routes.ts'
import { resources } from '../data/schema.ts'
import type { Resource } from '../data/schema.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderVerwaltungPage } from '../ui/verwaltung-layout.tsx'
import { AdminResourcesPage } from '../ui/admin-resources-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { paginate } from '../utils/pagination.ts'
import {
  gridStateFromForm,
  gridStateToParams,
} from '../utils/grid-state.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { pool } from '../data/setup.ts'

type Row = Resource

const PAGE_SIZE = 15

const SORTABLE_FIELDS = ['id', 'description', 'created_at', 'updated_at'] as const

/** PostgreSQL error code for foreign key violation (RESTRICT). */
const PG_FOREIGN_KEY_VIOLATION = '23503'

function isForeignKeyViolation(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string }
    return err.code === PG_FOREIGN_KEY_VIOLATION
  }
  return false
}

const resourceSaveSchema = f.object({
  description: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

export default createController<typeof routes.verwaltung.resources, AppContext>(routes.verwaltung.resources, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let db = context.db
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageNum = Math.floor(offset / PAGE_SIZE) + 1
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'description',
        defaultDirection: 'asc',
      })

      let filterPredicate = filter
        ? ilike('description', `%${filter}%`)
        : undefined

      let { items: page, hasMore } = await paginate(db, resources, {
        pageSize: PAGE_SIZE,
        page: pageNum,
        orderBy: [[column, direction]],
        where: filterPredicate as Record<string, unknown>,
      })

      let rows = page as Row[]

      // Check for inline editing state
      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: Row | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        editRow = (await db.findOne(resources, { where: { id: editingRowId } })) as Row | null
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderVerwaltungPage(
        context.render,
        <AdminResourcesPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - PAGE_SIZE)}
          nextOffset={offset + PAGE_SIZE}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
          editRow={editRow}
          creating={creating}
        />,
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData

      let parsed: Record<string, string>
      try {
        parsed = s.parse(resourceSaveSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      if (!parsed.description || !parsed.description.trim()) {
        return context.json({ ok: false, error: 'Description is required' }, { status: 400 })
      }

      let row = await db.create(
        resources,
        { description: parsed.description.trim() },
        { returnRow: true },
      )

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'resources',
          target_id: row.id as number,
          details: { description: parsed.description.trim() },
        })
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let baseUrl = routes.verwaltung.resources.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + '?' + params.toString() },
      })
    },

    async update(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let parsed: Record<string, string>
      try {
        parsed = s.parse(resourceSaveSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      if (!parsed.description || !parsed.description.trim()) {
        return context.json({ ok: false, error: 'Description is required' }, { status: 400 })
      }

      await db.updateMany(resources, { description: parsed.description.trim() }, { where: { id } })

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'resources',
          target_id: id,
          details: { description: parsed.description.trim() },
        })
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.verwaltung.resources.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let existing = await db.findOne(resources, { where: { id } })
      if (!existing) {
        return context.json({ ok: false, error: 'Resource not found' }, { status: 404 })
      }

      try {
        await db.deleteMany(resources, { where: { id } })
      } catch (error: unknown) {
        if (isForeignKeyViolation(error)) {
          return context.json({ ok: false, error: 'Resource is in use and cannot be deleted' }, { status: 400 })
        }
        throw error
      }

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'resources',
          target_id: id,
        })
      }

      let parsed: Record<string, string>
      try {
        parsed = s.parse(resourceSaveSchema, formData) as Record<string, string>
      } catch {
        parsed = { description: '', _offset: '', _sort: '', _order: '', _filter: '' }
      }
      let params = gridStateToParams(gridStateFromForm(parsed))
      let qs = params.toString()
      let baseUrl = routes.verwaltung.resources.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },
  },
})
