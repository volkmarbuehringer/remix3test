import { createController } from 'remix/router'
import { ilike, or, type Database, type WhereInput } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { minLength, email } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'

import { parseId } from '../../utils/ids.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { routes } from '../../routes.ts'
import { clients } from '../../data/schema.ts'
import type { Client } from '../../data/schema.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { getAdminIdentity } from '../../utils/context.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { ClientPage } from './page.tsx'
import { paginate } from '../../utils/pagination.ts'
import { parseSort } from '../../utils/sort-params.ts'
import { isConstraintViolation } from '../../utils/db-errors.ts'
import { getPageSize } from '../../utils/get-page-size.ts'
import {
  gridStateFromURL,
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
  editingRedirect,
} from '../../utils/grid-state.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { renderGridFormError, type AdminGridErrorState } from '../../ui/admin-grid-error.tsx'

type Row = Client

const PAGE_SIZE = 15
const CLIENT_FORM_KEYS = [
  'name',
  'email',
  'role',
  'status',
  'registered',
  '_offset',
  '_sort',
  '_order',
  '_filter',
] as const
const SORTABLE_FIELDS = ['id', 'name', 'email', 'role', 'status', 'registered'] as const

const clientSaveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  role: f.field(s.defaulted(s.string(), '')),
  status: f.field(s.defaulted(s.string(), '')),
  registered: f.field(
    s.defaulted(s.string(), '0').refine((value) => {
      if (!value || value === '0') return true
      let year = Number(value.split('-')[0])
      return !isNaN(year) && year === 2026
    }, 'Year must be 2026'),
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

/** Builds the WHERE predicate for the grid from the single `filter` query param. */
function buildClientsFilterPredicate(filter?: string): WhereInput | undefined {
  return filter === 'active'
    ? { status: 'Active' }
    : filter === 'inactive'
      ? { status: 'Inactive' }
      : filter && /^\d+$/.test(filter)
        ? { id: Number(filter) }
        : filter
          ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
          : undefined
}

async function loadGridData(
  db: Database,
  opts: {
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    pageSize: number
  },
): Promise<{ rows: Row[]; hasMore: boolean }> {
  let pageNum = Math.floor(opts.offset / opts.pageSize) + 1
  let { items: page, hasMore } = (await paginate(db, clients, {
    pageSize: opts.pageSize,
    page: pageNum,
    orderBy: [[opts.column, opts.direction]],
    where: buildClientsFilterPredicate(opts.filter),
  })) as { items: Row[]; page: number; hasMore: boolean }

  return { rows: page, hasMore }
}

function gridOffset(raw: Record<string, string>): number {
  return Math.max(0, Number(raw._offset) || 0)
}

function gridSortColumn(raw: Record<string, string>): string {
  let col = raw._sort
  return col && (SORTABLE_FIELDS as readonly string[]).includes(col) ? col : 'id'
}

function gridSortDirection(raw: Record<string, string>): 'asc' | 'desc' {
  return raw._order === 'desc' ? 'desc' : 'asc'
}

function gridFilter(raw: Record<string, string>): string | undefined {
  return raw._filter || undefined
}

function buildEditRowFromRaw(id: number, raw: Record<string, string>): Row {
  return {
    id,
    name: raw.name ?? '',
    email: raw.email ?? '',
    role: (raw.role || 'Viewer') as Row['role'],
    status: (raw.status || 'Active') as Row['status'],
    registered: raw.registered ? parseDate(raw.registered) : Date.now(),
  }
}

type ClientsRenderContext = { db: Database; render: Parameters<typeof renderAdminPage>[0] }

async function renderClientsError(
  context: ClientsRenderContext,
  opts: {
    creating?: boolean
    editRow?: Row | null
    formValues?: Record<string, string>
    fieldErrors?: Record<string, string>
    formError?: string
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    pageSize: number
  },
): Promise<Response> {
  let grid: AdminGridErrorState = {
    offset: opts.offset,
    sortColumn: opts.column,
    sortDirection: opts.direction,
    filter: opts.filter,
    pageSize: opts.pageSize,
  }
  return renderGridFormError<Row>({
    render: context.render,
    activeItem: 'clients',
    loadRows: () =>
      loadGridData(context.db, {
        offset: opts.offset,
        column: opts.column,
        direction: opts.direction,
        filter: opts.filter,
        pageSize: opts.pageSize,
      }),
    buildPage: (page) => (
      <ClientPage
        rows={page.rows}
        offset={page.offset}
        hasMore={page.hasMore}
        prevOffset={Math.max(0, page.offset - page.pageSize)}
        nextOffset={page.offset + page.pageSize}
        sortColumn={page.sortColumn}
        sortDirection={page.sortDirection}
        filter={page.filter}
        editRow={opts.editRow ?? null}
        creating={opts.creating ?? false}
        pageSize={page.pageSize}
        formValues={page.formValues}
        fieldErrors={page.fieldErrors}
        formError={page.formError}
      />
    ),
    formValues: opts.formValues,
    fieldErrors: opts.fieldErrors,
    formError: opts.formError,
    grid,
  })
}

export default createController(routes.admin.clients, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    // -- GET /admin/clients -- Render main page --
    async index(context) {
      let db = context.db
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

      let { rows, hasMore } = await loadGridData(db, {
        offset,
        column,
        direction: direction as 'asc' | 'desc',
        filter,
        pageSize: effectivePageSize,
      })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: Row | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        editRow = (await db.find(clients, { id: editingRowId })) as Row | null
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'clients',
        <ClientPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - effectivePageSize)}
          nextOffset={offset + effectivePageSize}
          sortColumn={column}
          sortDirection={direction as 'asc' | 'desc'}
          filter={filter}
          editRow={editRow}
          creating={creating}
          pageSize={effectivePageSize}
        />,
      )
    },

    // -- GET /admin/clients/edit/:rowId -- Redirect to inline edit via ?editing= --
    async edit(context) {
      let rowId = parseId(context.params.rowId)
      if (rowId === undefined || rowId < 1) {
        return new Response('Invalid row ID', { status: 400 })
      }

      return editingRedirect(
        routes.admin.clients.index.href(),
        rowId,
        gridStateFromURL(context.url),
      )
    },

    // -- PUT /admin/clients/:id -- Update a client row --
    async update(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        return renderClientsError(context, {
          editRow: buildEditRowFromRaw(id, rawValues),
          formValues: rawValues,
          fieldErrors: issuesToFieldErrors(parsed.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }

      let fields = parsed.value
      let bulkFields = ['name', 'email', 'role', 'status', 'registered'] as const
      let changes: Record<string, string | number> = {}
      for (let field of bulkFields) {
        let v = fields[field]
        if (v) {
          if (field === 'registered') {
            changes[field] = parseDate(v)
          } else {
            changes[field] = v
          }
        }
      }

      await db.updateMany(clients, changes, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'clients',
          target_id: id,
          details: { changes },
        })
      }

      return editingRedirect(routes.admin.clients.index.href(), id, gridStateFromForm(rawValues))
    },

    // -- DELETE /admin/clients/:id -- Delete a client row --
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
        if (isConstraintViolation(error))
          message = 'Cannot delete: this client has related records.'
        return context.json({ ok: false, error: message }, { status: 409 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'clients',
          target_id: id,
        })
      }

      let redirectState = gridStateFromForm(readFormFieldValues(CLIENT_FORM_KEYS, formData))
      return editingRedirect(routes.admin.clients.index.href(), null, redirectState)
    },

    // -- POST /admin/clients/:id/toggle-status -- Toggle a client's status --
    async toggleStatus(context) {
      let db = context.db
      let id = parseId(context.params.id)

      let params = gridStateToParams(gridStateFromFormData(context.formData))
      let baseUrl = routes.admin.clients.index.href()

      let fail = (message: string): Response => {
        context.session.flash('error', message)
        let qs = params.toString()
        return redirect(baseUrl + (qs ? '?' + qs : ''))
      }

      if (id === undefined || id < 1) {
        return fail('Ungültige Kunden-ID.')
      }

      let existing = await db.findOne(clients, { where: { id } })
      if (!existing) {
        return fail('Kunde nicht gefunden.')
      }

      let client = existing as Client
      let newStatus = client.status === 'Active' ? 'Inactive' : 'Active'
      await db.updateMany(clients, { status: newStatus }, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'clients',
          target_id: id,
          details: { status: newStatus },
        })
      }

      let qs = params.toString()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },

    // -- POST /admin/clients -- Create a new client row --
    async create(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        return renderClientsError(context, {
          creating: true,
          formValues: rawValues,
          fieldErrors: issuesToFieldErrors(parsed.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }

      let fields = parsed.value
      let row = await db.create(
        clients,
        {
          name: fields.name || 'New Client',
          email: fields.email || `${Date.now()}@example.com`,
          role: fields.role || 'Viewer',
          status: fields.status || 'Active',
          registered: fields.registered ? parseDate(fields.registered) : Date.now(),
        },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'clients',
          target_id: row.id as number,
          details: {
            name: (row as Row).name,
            email: (row as Row).email,
            role: (row as Row).role,
            status: (row as Row).status,
          },
        })
      }

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let qs = params.toString()
      return redirect(routes.admin.clients.index.href() + (qs ? '?' + qs : ''))
    },
  },
})
