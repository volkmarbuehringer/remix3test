import { createController } from 'remix/router'
import { ilike, or } from 'remix/data-table'
import type { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { minLength, email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { parseId } from '../../utils/ids.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { JsonBody } from '../../middleware/json-body.ts'
import { routes } from '../../routes.ts'
import { clients } from '../../data/schema.ts'
import type { Client } from '../../data/schema.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { ClientPage } from './page.tsx'
import { paginate } from '../../utils/pagination.ts'
import type { AppContext } from '../../types/context.ts'
import { parseSort } from '../../utils/sort-params.ts'
import { isConstraintViolation } from '../../utils/db-errors.ts'
import { getPageSize } from '../../utils/get-page-size.ts'
import {
  gridStateFromURL,
  gridStateFromForm,
  gridStateToParams,
  editingRedirect,
} from '../../utils/grid-state.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'

type Row = Client

const PAGE_SIZE = 20
const CLIENT_FORM_KEYS = ['name', 'email', 'role', 'status', 'registered', '_offset', '_sort', '_order', '_filter'] as const
const SORTABLE_FIELDS = ['id', 'name', 'email', 'role', 'status', 'registered'] as const
const VALID_FIELDS = ['id', 'name', 'email', 'role', 'status', 'registered'] as const
const FIELD_OPTIONS: Record<string, string[]> = {
  role: ['Admin', 'Editor', 'Viewer'],
  status: ['Active', 'Inactive'],
}

const clientSaveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  role: f.field(s.defaulted(s.string(), '')),
  status: f.field(s.defaulted(s.string(), '')),
  registered: f.field(
    s.defaulted(s.string(), '0').refine(
      (value) => {
        if (!value || value === '0') return true
        let year = Number(value.split('-')[0])
        return !isNaN(year) && year === 2026
      },
      'Year must be 2026',
    ),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

function parseDate(value: string): number {
  let ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : Date.now()
}

async function fetchGridData(db: Database, opts: { offset: number; column: string; direction: 'asc' | 'desc'; filter?: string; pageSize?: number }) {
  let effectivePageSize = opts.pageSize ?? getPageSize(undefined, PAGE_SIZE)
  let pageNum = Math.floor(opts.offset / effectivePageSize) + 1
  let filter = opts.filter

  let filterPredicate = filter
    ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
    : undefined

  let { items: page, hasMore } = (await paginate(db as Database, clients, {
    pageSize: effectivePageSize,
    page: pageNum,
    orderBy: [[opts.column, opts.direction]],
    where: filterPredicate as Record<string, unknown>,
  })) as { items: Row[]; page: number; hasMore: boolean }

  return { rows: page, hasMore, effectivePageSize }
}

export default createController<typeof routes.admin.client, AppContext>(routes.admin.client, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    // ── GET /admin/client — Render main page ──
    async index(context) {
      let db = context.db
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

      let { rows: page, hasMore, effectivePageSize } = await fetchGridData(db, {
        offset, column, direction: direction as 'asc' | 'desc', filter, pageSize: getPageSize(context.session, PAGE_SIZE),
      })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: Row | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        editRow = (await db.find(clients, { id: editingRowId })) as Row | null
      }

      // Check if create form was requested
      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(context.render, 'client',
        <ClientPage
          rows={page}
          offset={offset}
          hasMore={hasMore}
          sortField={column}
          sortOrder={direction}
          filter={filter}
          pageSize={effectivePageSize}
          editRow={editRow}
          creating={creating}
          editingOffset={String(offset)}
          editingSort={column}
          editingOrder={direction}
          editingFilter={filter}
        />,
      )
    },

    // ── GET /admin/client/edit/:rowId — Redirect to inline edit via ?editing= ──
    async edit(context) {
      let rowId = parseId(context.params.rowId)
      if (rowId === undefined || rowId < 1) {
        return new Response('Invalid row ID', { status: 400 })
      }

      return editingRedirect('/admin/client', rowId, gridStateFromURL(context.url))
    },

    // ── PUT /admin/client/:id — Update a client row ──
    async update(context) {
      let db = context.db
      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      // Handle JSON body (inline edit) vs form data (sidebar edit)
      let contentType = context.request.headers.get('Content-Type') || ''
      let isJson = contentType.includes('application/json')

      if (isJson) {
        let body = context.get(JsonBody) as Record<string, unknown> | undefined
        let emailVal = typeof body?.email === 'string' ? (body.email as string).trim() : ''
        if (!emailVal) {
          return context.json({ ok: false, error: 'Email is required' }, { status: 400 })
        }
        let parsed = s.parseSafe(s.string().pipe(email()), emailVal)
        if (!parsed.success) {
          let firstIssue = parsed.issues[0]
          return context.json({ ok: false, error: firstIssue?.message || 'Invalid email' }, { status: 400 })
        }
        await db.updateMany(clients, { email: emailVal }, { where: { id } })
        return context.json({ ok: true })
      }

      let formData = context.formData

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let editRow: Row = {
          id,
          name: rawValues.name,
          email: rawValues.email,
          role: (rawValues.role || 'Viewer') as Row['role'],
          status: (rawValues.status || 'Active') as Row['status'],
          registered: rawValues.registered ? parseDate(rawValues.registered) : Date.now(),
        }
        let { rows: gridRows, hasMore, effectivePageSize } = await fetchGridData(db, {
          offset: Number(rawValues._offset) || 0,
          column: rawValues._sort || 'id',
          direction: (rawValues._order as 'asc' | 'desc') || 'asc',
          filter: rawValues._filter,
        })
        return renderAdminPage(context.render, 'client',
          <ClientPage
            rows={gridRows}
            offset={Number(rawValues._offset) || 0}
            hasMore={hasMore}
            sortField={rawValues._sort || 'id'}
            sortOrder={(rawValues._order as 'asc' | 'desc') || 'asc'}
            filter={rawValues._filter}
            pageSize={effectivePageSize}
            editRow={editRow}
            formValues={rawValues}
            fieldErrors={fieldErrors}
            editingOffset={rawValues._offset}
            editingSort={rawValues._sort}
            editingOrder={rawValues._order}
            editingFilter={rawValues._filter}
          />,
          { status: 400 },
        )
      }

      let bulkFields = ['name', 'email', 'role', 'status', 'registered'] as const
      let changes: Record<string, string | number> = {}
      for (let field of bulkFields) {
        let v = parsed.value[field]
        if (v) {
          if (field === 'registered') {
            changes[field] = parseDate(v)
          } else {
            changes[field] = v
          }
        }
      }

      await db.updateMany(clients, changes, { where: { id } })

      // Redirect back to main page with preserved state
      return editingRedirect(routes.admin.client.index.href(), id, gridStateFromForm(rawValues))
    },

    // ── DELETE /admin/client/:id — Delete a client row ──
    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      try {
        await db.delete(clients, { id })
      } catch (error) {
        let message = 'Delete failed. Please try again.'
        if (isConstraintViolation(error)) message = 'Cannot delete: this client has related records.'
        return context.json({ ok: false, error: message }, { status: 409 })
      }

      // Redirect back to grid with preserved state
      let redirectState = gridStateFromForm(readFormFieldValues(CLIENT_FORM_KEYS, formData))
      return editingRedirect('/admin/client', null, redirectState)
    },

    // ── POST /admin/client — Create a new client row ──
    async create(context) {
      let db = context.db
      let formData = context.formData

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let { rows: gridRows, hasMore, effectivePageSize } = await fetchGridData(db, {
          offset: Number(rawValues._offset) || 0,
          column: rawValues._sort || 'id',
          direction: (rawValues._order as 'asc' | 'desc') || 'asc',
          filter: rawValues._filter,
        })
        return renderAdminPage(context.render, 'client',
          <ClientPage
            rows={gridRows}
            offset={Number(rawValues._offset) || 0}
            hasMore={hasMore}
            sortField={rawValues._sort || 'id'}
            sortOrder={(rawValues._order as 'asc' | 'desc') || 'asc'}
            filter={rawValues._filter}
            pageSize={effectivePageSize}
            creating={true}
            formValues={rawValues}
            fieldErrors={fieldErrors}
            editingOffset={rawValues._offset}
            editingSort={rawValues._sort}
            editingOrder={rawValues._order}
            editingFilter={rawValues._filter}
          />,
          { status: 400 },
        )
      }

      let row = await db.create(
        clients,
        {
          name: parsed.value.name || 'New Client',
          email: parsed.value.email || `${Date.now()}@example.com`,
          role: parsed.value.role || 'Viewer',
          status: parsed.value.status || 'Active',
          registered: parsed.value.registered ? parseDate(parsed.value.registered) : Date.now(),
        },
        { returnRow: true },
      )

      // Preserve grid state in redirect
      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let qs = params.toString()
      return redirect('/admin/client' + (qs ? '?' + qs : ''))
    },
  },
})
