import { createController } from 'remix/router'
import { ilike, or } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { minLength, email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { clients } from '../../data/schema.ts'
import type { Client } from '../../data/schema.ts'
import { Layout } from '../../ui/layout.tsx'
import { ClientPage } from './page.tsx'
import { ClientGridPage } from './grid-page.tsx'
import { paginate } from '../../utils/pagination.ts'
import { parseSort } from '../../utils/sort-params.ts'
import {
  gridStateFromURL,
  gridStateFromForm,
  gridStateToParams,
  editingRedirect,
} from '../../utils/grid-state.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
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

export default createController(routes.client, {
  middleware: [requireAuth()],
  actions: {
    // ── GET /client — Render main page with grid Frame ──
    async index(context) {
      let db = context.db
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageNum = Math.floor(offset / PAGE_SIZE) + 1
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

      let filterPredicate = filter
        ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
        : undefined

      let { items: page, hasMore } = (await paginate(db, clients, {
        pageSize: PAGE_SIZE,
        page: pageNum,
        orderBy: [[column, direction]],
        where: filterPredicate as Record<string, unknown>,
      })) as { items: Row[]; page: number; hasMore: boolean }

      // Build the initial Frame src (uses raw URL offset, not displayOffset,
      // so the edit URL preserves the user's current page through save/redirect)
      let gridState = gridStateFromURL(context.url)
      let frameParams = gridStateToParams(gridState)
      // Forward editing param so the grid can highlight the row being edited
      let editingParam = context.url.searchParams.get('editing')
      if (editingParam) frameParams.set('editing', editingParam)
      let frameSrc = '/client/grid?' + frameParams.toString()

      // Check if an inline edit was requested
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: Row | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        editRow = (await db.find(clients, { id: editingRowId })) as Row | null
      }

      // Check if create form was requested
      let creating = context.url.searchParams.get('creating') === 'true'

      return context.render(
        <Layout title="Client">
          <ClientPage
            frameSrc={frameSrc}
            editRow={editRow}
            creating={creating}
            editingOffset={String(offset)}
            editingSort={column}
            editingOrder={direction}
            editingFilter={filter}
          />
        </Layout>,
      )
    },

    // ── GET /client/grid — Grid fragment (for Frame) or full page ──
    async grid(context) {
      let db = context.db
      let isFrame = context.request.headers.get('X-Remix-Frame') === 'true'

      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageNum = Math.floor(offset / PAGE_SIZE) + 1
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

      let filterPredicate = filter
        ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
        : undefined

      let { items: page, hasMore } = (await paginate(db, clients, {
        pageSize: PAGE_SIZE,
        page: pageNum,
        orderBy: [[column, direction]],
        where: filterPredicate as Record<string, unknown>,
      })) as { items: Row[]; page: number; hasMore: boolean }

      let total = offset + page.length
      let hasPrev = offset > 0

      let editingParam = context.url.searchParams.get('editing')
      let editingId = editingParam ? Number(editingParam) : null

      let gridContent = (
        <ClientGridPage
          rows={page}
          offset={offset}
          hasPrev={hasPrev}
          hasNext={hasMore}
          sortField={column}
          sortOrder={direction}
          totalRows={total}
          filter={filter}
          fieldOptions={FIELD_OPTIONS}
          editingId={editingId}
        />
      )

      if (isFrame) {
        return context.render(gridContent, fragmentResponseInit())
      }

      return context.render(<Layout title="Client Lab">{gridContent}</Layout>)
    },

    // ── GET /client/edit/:rowId — Redirect to inline edit via ?editing= ──
    async edit(context) {
      let rowId = Number(context.params.rowId)
      if (!Number.isFinite(rowId) || rowId < 1) {
        return new Response('Invalid row ID', { status: 400 })
      }

      return editingRedirect('/client', rowId, gridStateFromURL(context.url))
    },

    // ── PUT /client/:id — Update a client row ──
    async update(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

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
        let frameParams = gridStateToParams({ offset: rawValues._offset, sort: rawValues._sort, order: rawValues._order, filter: rawValues._filter })
        frameParams.set('editing', String(id))
        let frameSrc = '/client/grid?' + frameParams.toString()
        return context.render(
          <Layout title="Client Lab">
            <ClientPage
              frameSrc={frameSrc}
              editRow={editRow}
              formValues={rawValues}
              fieldErrors={fieldErrors}
              editingOffset={rawValues._offset}
              editingSort={rawValues._sort}
              editingOrder={rawValues._order}
              editingFilter={rawValues._filter}
            />
          </Layout>,
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
      return editingRedirect(routes.client.index.href(), id, gridStateFromForm(rawValues))
    },

    // ── DELETE /client/:id — Delete a client row, redirect to grid ──
    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      await db.delete(clients, { id })

      // Redirect back to grid with preserved state
      let redirectState = gridStateFromForm(readFormFieldValues(CLIENT_FORM_KEYS, formData))
      return editingRedirect('/client', null, redirectState)
    },

    // ── POST /client — Create a new client row ──
    async create(context) {
      let db = context.db
      let formData = context.formData

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let frameParams = gridStateToParams({ offset: rawValues._offset, sort: rawValues._sort, order: rawValues._order, filter: rawValues._filter })
        frameParams.set('creating', 'true')
        let frameSrc = '/client/grid?' + frameParams.toString()
        return context.render(
          <Layout title="Client Lab">
            <ClientPage
              frameSrc={frameSrc}
              creating={true}
              formValues={rawValues}
              fieldErrors={fieldErrors}
              editingOffset={rawValues._offset}
              editingSort={rawValues._sort}
              editingOrder={rawValues._order}
              editingFilter={rawValues._filter}
            />
          </Layout>,
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
      return redirect('/client' + (qs ? '?' + qs : ''))
    },
  },
})
