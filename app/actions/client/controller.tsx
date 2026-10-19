import { createController } from 'remix/router'
import { ilike, or, type Database, type WhereInput } from 'remix/data-table'
import * as s from 'remix/data-schema'
import { minLength, maxLength, email } from 'remix/data-schema/checks'
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
import type { AppContext } from '../../types/context.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { ClientPage } from './page.tsx'
import { paginate } from '../../utils/pagination.ts'
import { parseSort } from '../../utils/sort-params.ts'
import { isConstraintViolation } from '../../utils/db-errors.ts'
import { getPageSize, getPageSizeOverride, PAGE_SIZE_KEYS } from '../../utils/get-page-size.ts'
import {
  gridFilter,
  gridOffset,
  gridSortColumn,
  gridSortDirection,
} from '../../utils/grid-params.ts'
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
const CLIENT_OPTIONAL_FORM_KEYS = ['role', 'status', 'registered'] as const
const CLIENT_ROLES = ['Admin', 'Editor', 'Viewer'] as const
const CLIENT_STATUSES = ['Active', 'Inactive'] as const

/**
 * The lab's registered-date rule: a real calendar date in 2026. Date-only
 * strings parse as UTC midnight; comparing the round-trip catches rollovers
 * such as 2026-02-30 instead of accepting whatever the Date constructor did.
 */
function isClientRegisteredDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  let date = new Date(value + 'T00:00:00Z')
  if (Number.isNaN(date.getTime())) return false

  return date.getUTCFullYear() === 2026 && date.toISOString().slice(0, 10) === value
}

const clientSaveSchema = f.object({
  name: f.field(
    s
      .defaulted(s.string(), '')
      .pipe(minLength(8), maxLength(100))
      .refine((value) => value.trim().length >= 8, 'Der Name muss mindestens 8 Zeichen enthalten.'),
  ),
  email: f.field(s.defaulted(s.string(), '').pipe(email(), maxLength(100))),
  role: f.field(s.optional(s.enum_(CLIENT_ROLES))),
  status: f.field(s.optional(s.enum_(CLIENT_STATUSES))),
  registered: f.field(
    s.defaulted(s.string(), '').refine((value) => {
      if (!value || value === '0') return true
      return isClientRegisteredDate(value)
    }, 'Bitte ein gültiges Datum aus 2026 angeben.'),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

function parseDate(value: string): number | undefined {
  if (!value || value === '0') return undefined
  let ts = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(ts) ? ts : undefined
}

/** Map the schema's built-in English check messages to the German UI copy. */
function clientFieldErrors(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> | undefined }>,
): Record<string, string> {
  let errors = issuesToFieldErrors(issues)

  if (errors.name === 'Expected at least 8 characters') {
    errors.name = 'Der Name muss mindestens 8 Zeichen enthalten.'
  }
  if (errors.name === 'Expected at most 100 characters') {
    errors.name = 'Der Name darf höchstens 100 Zeichen enthalten.'
  }
  if (errors.email === 'Expected valid email') {
    errors.email = 'Bitte eine gültige E-Mail-Adresse eingeben.'
  }
  if (errors.email === 'Expected at most 100 characters') {
    errors.email = 'Die E-Mail-Adresse darf höchstens 100 Zeichen enthalten.'
  }
  if (errors.role) errors.role = 'Ungültige Rolle.'
  if (errors.status) errors.status = 'Ungültiger Status.'

  return errors
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

/**
 * Values for the edit panel after a failed update. Required fields are always
 * present (empty when omitted, so their error stays visible); optional fields
 * are omitted when absent so the panel falls back to the row's current value
 * instead of inventing a role, status, or date.
 */
function readClientFormValues(formData: FormData): Record<string, string> {
  let values = readFormFieldValues(CLIENT_FORM_KEYS, formData)
  for (let key of CLIENT_OPTIONAL_FORM_KEYS) {
    if (!formData.has(key)) delete values[key]
  }
  return values
}

type ClientsRenderContext = {
  db: Database
  render: Parameters<typeof renderAdminPage>[0]
  session: AppContext['session']
}

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
  let pageKey = PAGE_SIZE_KEYS.adminClients
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let grid: AdminGridErrorState = {
    offset: opts.offset,
    sortColumn: opts.column,
    sortDirection: opts.direction,
    filter: opts.filter,
    pageSize: opts.pageSize,
    pageKey,
    pageSizeOverride,
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
        nextOffset={page.offset + page.pageSize}
        sortColumn={page.sortColumn}
        sortDirection={page.sortDirection}
        filter={page.filter}
        editRow={opts.editRow ?? null}
        creating={opts.creating ?? false}
        pageSize={page.pageSize}
        pageKey={page.pageKey}
        pageSizeOverride={page.pageSizeOverride}
        formValues={page.formValues}
        fieldErrors={page.fieldErrors}
        formError={page.formError}
      />
    ),
    formValues: opts.formValues,
    fieldErrors: opts.fieldErrors,
    formError: opts.formError,
    fullHeight: !(opts.editRow || opts.creating),
    grid,
  })
}

type ClientsIndexContext = Pick<AppContext, 'db' | 'render' | 'session' | 'url'>

/**
 * Shared renderer for the clients grid. Reads the grid state (offset, sort,
 * order, filter) from the request URL. Used by the index action and by the
 * frame action-path resolvers, which re-render the grid when a stale frame
 * reload GETs a POST/PUT/DELETE-only path.
 */
async function renderClientsIndex(
  context: ClientsIndexContext,
  overrides: { editingId?: number | null; creating?: boolean } = {},
): Promise<Response> {
  let pageKey = PAGE_SIZE_KEYS.adminClients
  let effectivePageSize = getPageSize(context.session, PAGE_SIZE, pageKey)
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = context.url.searchParams.get('filter') || undefined

  let { column, direction } = parseSort(context.url, {
    allowedColumns: SORTABLE_FIELDS,
    defaultColumn: 'id',
    defaultDirection: 'asc',
  })

  let { rows, hasMore } = await loadGridData(context.db, {
    offset,
    column,
    direction: direction as 'asc' | 'desc',
    filter,
    pageSize: effectivePageSize,
  })

  let editingRowId =
    overrides.editingId !== undefined
      ? overrides.editingId
      : parseId(context.url.searchParams.get('editing'))
  let editRow: Row | null = null
  if (editingRowId && editingRowId > 0) {
    editRow = (await context.db.find(clients, { id: editingRowId })) as Row | null
  }

  let creating =
    overrides.creating !== undefined
      ? overrides.creating
      : context.url.searchParams.get('creating') === 'true'

  return renderAdminPage(
    context.render,
    'clients',
    <ClientPage
      rows={rows}
      offset={offset}
      hasMore={hasMore}
      nextOffset={offset + effectivePageSize}
      sortColumn={column}
      sortDirection={direction as 'asc' | 'desc'}
      filter={filter}
      editRow={editRow}
      creating={creating}
      pageSize={effectivePageSize}
      pageKey={pageKey}
      pageSizeOverride={pageSizeOverride}
    />,
    { fullHeight: !(editRow || creating) },
  )
}

export default createController(routes.admin.clients, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    // -- GET /admin/clients -- Render main page --
    async index(context) {
      return renderClientsIndex(context)
    },

    // -- GET /admin/clients/:id -- Resolve the PUT/DELETE form action path --
    // The frame commits the form action path as its src; a later reload GETs
    // it. Render the edit panel while the row exists, and the grid after a
    // delete or for a stale id, instead of returning 404.
    async show(context) {
      let rowId = parseId(context.params.id)
      return renderClientsIndex(context, {
        editingId: rowId ?? null,
        creating: false,
      })
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
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE, PAGE_SIZE_KEYS.adminClients)

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        let existing = (await db.findOne(clients, { where: { id } })) as Row | null
        if (!existing) {
          context.session.flash('error', 'Kunde nicht gefunden.')
          return editingRedirect(
            routes.admin.clients.index.href(),
            null,
            gridStateFromForm(rawValues),
          )
        }

        return renderClientsError(context, {
          editRow: existing,
          formValues: readClientFormValues(formData),
          fieldErrors: clientFieldErrors(parsed.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues, SORTABLE_FIELDS, 'id'),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }

      let fields = parsed.value
      let changes: Record<string, string | number> = {
        name: fields.name,
        email: fields.email,
      }
      if (fields.role !== undefined) changes.role = fields.role
      if (fields.status !== undefined) changes.status = fields.status
      let registered = parseDate(fields.registered)
      if (registered !== undefined) changes.registered = registered

      let result = await db.updateMany(clients, changes, { where: { id } })
      if (result.affectedRows === 0) {
        context.session.flash('error', 'Kunde nicht gefunden.')
        return editingRedirect(
          routes.admin.clients.index.href(),
          null,
          gridStateFromForm(rawValues),
        )
      }

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

      let redirectState = gridStateFromForm(readFormFieldValues(CLIENT_FORM_KEYS, formData))

      try {
        let deleted = await db.delete(clients, { id })
        if (!deleted) {
          context.session.flash('error', 'Kunde nicht gefunden.')
          return editingRedirect(routes.admin.clients.index.href(), null, redirectState)
        }
      } catch (error) {
        let message = isConstraintViolation(error)
          ? 'Kunde kann nicht gelöscht werden: abhängige Datensätze vorhanden.'
          : 'Löschen fehlgeschlagen. Bitte erneut versuchen.'
        context.session.flash('error', message)
        return editingRedirect(routes.admin.clients.index.href(), null, redirectState)
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

    // -- GET /admin/clients/:id/toggle-status -- Resolve the toggle action path --
    // The frame commits the POST toggle action path as its src; a stale reload
    // GETs it. Render the grid instead of returning 405.
    async toggleStatusResolve(context) {
      return renderClientsIndex(context)
    },

    // -- POST /admin/clients -- Create a new client row --
    async create(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE, PAGE_SIZE_KEYS.adminClients)

      let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
      let parsed = s.parseSafe(clientSaveSchema, formData)

      if (!parsed.success) {
        return renderClientsError(context, {
          creating: true,
          formValues: rawValues,
          fieldErrors: clientFieldErrors(parsed.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues, SORTABLE_FIELDS, 'id'),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }

      let fields = parsed.value
      let row = await db.create(
        clients,
        {
          name: fields.name,
          email: fields.email,
          role: fields.role ?? 'Viewer',
          status: fields.status ?? 'Active',
          registered: parseDate(fields.registered) ?? Date.now(),
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
