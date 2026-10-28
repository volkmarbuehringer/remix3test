import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import type { Database, TableRow } from 'remix/data-table'

import { parseId } from '../../../utils/ids.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { lists } from '../../../data/schema.ts'
import {
  countLists,
  findListRow,
  isListItemFilter,
  LIST_SORTABLE_FIELDS,
  listsSearchPattern,
  searchLists,
  type ListRow,
} from '../../../data/admin-lists.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import type { AppContext } from '../../../types/context.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
} from '../../../utils/grid-state.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import {
  gridFilter,
  gridOffset,
  gridSortColumn,
  gridSortDirection,
} from '../../../utils/grid-params.ts'
import { getPageSize, getPageSizeOverride, PAGE_SIZE_KEYS } from '../../../utils/get-page-size.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { renderGridFormError, type AdminGridErrorState } from '../../../ui/admin-grid-error.tsx'
import { AdminListsPage } from '../../../ui/admin-lists-page.tsx'

const LISTS_PAGE_LIMIT = 10

// Derived from the data layer's whitelist so the grid headers and the SQL
// ORDER BY cannot drift apart.
const SORTABLE_FIELDS = LIST_SORTABLE_FIELDS

const LISTS_FORM_KEYS = [
  'title',
  'description',
  '_offset',
  '_sort',
  '_order',
  '_filter',
  '_status',
] as const

const listsCreateSchema = f.object({
  title: f.field(s.defaulted(s.string(), '').pipe(minLength(1))),
  description: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const listsUpdateSchema = f.object({
  title: f.field(s.defaulted(s.string(), '').pipe(minLength(1))),
  description: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

// ── Helpers ──

function listFormValues(raw: Record<string, string>): Record<string, string> {
  return { title: raw.title ?? '', description: raw.description ?? '' }
}

/** Whitelist the hidden `_status` grid field (item-count filter) so an
 *  arbitrary submitted value can never reach the SQL builder. */
function gridStatus(raw: Record<string, string>): string | undefined {
  let value = raw._status
  return isListItemFilter(value) ? value : undefined
}

function listsGridUrl(formData: FormData, offsetOverride?: number): string {
  let state = gridStateFromFormData(formData)
  if (offsetOverride !== undefined) state.offset = String(Math.max(0, offsetOverride))
  let params = gridStateToParams(state)
  let qs = params.toString()
  let base = routes.admin.lists.index.href()
  return base + (qs ? '?' + qs : '')
}

async function loadGridData(
  db: Database,
  opts: {
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    status?: string | undefined
    pageSize: number
  },
): Promise<{ rows: ListRow[]; hasMore: boolean; total: number }> {
  let limit = opts.pageSize + 1
  let searchPattern = listsSearchPattern(opts.filter)
  // One query path for every view: searchLists always joins the owner, so the
  // Besitzer column is populated whether or not a text/status filter is active.
  // The total feeds the footer ("1–10 von 42" and numbered pages) and is
  // counted with the same WHERE builder as the rows, so the two cannot drift.
  let [rows, total] = await Promise.all([
    searchLists(db, searchPattern, limit, opts.offset, opts.column, opts.direction, opts.status),
    countLists(db, searchPattern, opts.status),
  ])
  let hasMore = rows.length > opts.pageSize
  if (hasMore) rows.pop()
  return { rows, hasMore, total }
}

type ListsRenderContext = {
  db: Database
  render: Parameters<typeof renderAdminPage>[0]
  session: AppContext['session']
}

async function renderListsError(
  context: ListsRenderContext,
  opts: {
    creating?: boolean
    editRow?: ListRow | null
    formValues?: Record<string, string>
    fieldErrors?: Record<string, string>
    formError?: string
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    status?: string | undefined
    pageSize: number
  },
): Promise<Response> {
  let pageKey = PAGE_SIZE_KEYS.adminLists
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let grid: AdminGridErrorState = {
    offset: opts.offset,
    sortColumn: opts.column,
    sortDirection: opts.direction,
    filter: opts.filter,
    status: opts.status,
    pageSize: opts.pageSize,
    pageKey,
    pageSizeOverride,
  }
  return renderGridFormError<ListRow>({
    render: context.render,
    activeItem: 'lists',
    loadRows: () =>
      loadGridData(context.db, {
        offset: opts.offset,
        column: opts.column,
        direction: opts.direction,
        filter: opts.filter,
        status: opts.status,
        pageSize: opts.pageSize,
      }),
    buildPage: (page) => (
      <AdminListsPage
        lists={page.rows}
        offset={page.offset}
        hasMore={page.hasMore}
        prevOffset={Math.max(0, page.offset - page.pageSize)}
        nextOffset={page.offset + page.pageSize}
        sortColumn={page.sortColumn}
        sortDirection={page.sortDirection}
        filter={page.filter}
        status={page.status}
        editRow={opts.editRow ?? null}
        creating={opts.creating ?? false}
        pageSize={page.pageSize}
        pageKey={page.pageKey}
        pageSizeOverride={page.pageSizeOverride}
        total={page.total ?? 0}
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

export default createController(routes.admin.lists, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let pageKey = PAGE_SIZE_KEYS.adminLists
      let effectivePageSize = getPageSize(context.session, LISTS_PAGE_LIMIT, pageKey)
      let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined
      let statusParam = context.url.searchParams.get('status')
      let status = isListItemFilter(statusParam) ? statusParam : undefined

      // Default to `updated_at DESC`: unlike `created_at` it is a visible
      // column, so the active-sort arrow on first load matches the row order.
      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'updated_at',
        defaultDirection: 'desc',
      })

      let { rows, hasMore, total } = await loadGridData(context.db, {
        offset,
        column,
        direction,
        filter,
        status,
        pageSize: effectivePageSize,
      })

      // parseId, not Number: a fractional id like `?editing=1.5` used to pass
      // Number.isFinite and reach the int4 comparison, 500ing the page.
      let editingRowId = parseId(context.url.searchParams.get('editing'))
      let editRow: ListRow | null = null
      if (editingRowId !== undefined && editingRowId > 0) {
        editRow = await findListRow(context.db, editingRowId)
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'lists',
        <AdminListsPage
          lists={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - effectivePageSize)}
          nextOffset={offset + effectivePageSize}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
          status={status}
          editRow={editRow}
          creating={creating}
          pageSize={effectivePageSize}
          pageKey={pageKey}
          pageSizeOverride={pageSizeOverride}
          total={total}
        />,
        { fullHeight: !(editRow || creating) },
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(
        context.session,
        LISTS_PAGE_LIMIT,
        PAGE_SIZE_KEYS.adminLists,
      )

      let rawValues = readFormFieldValues(LISTS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(listsCreateSchema, formData)

      if (!parseResult.success) {
        return renderListsError(context, {
          creating: true,
          formValues: listFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues, SORTABLE_FIELDS, 'updated_at'),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          status: gridStatus(rawValues),
          pageSize: effectivePageSize,
        })
      }
      let fields = parseResult.value

      let row = await db.create(
        lists,
        {
          title: fields.title.trim(),
          description: fields.description.trim(),
          list: [],
        },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'lists',
          target_id: row.id as number,
          details: { title: fields.title.trim() },
        })
      }

      context.session.flash('success', 'Liste erstellt.')

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      return redirect(routes.admin.lists.index.href() + '?' + params.toString())
    },

    async update(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(
        context.session,
        LISTS_PAGE_LIMIT,
        PAGE_SIZE_KEYS.adminLists,
      )

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        context.session.flash('error', 'Ungültige Listen-ID.')
        return redirect(listsGridUrl(formData))
      }

      let existing = await findListRow(db, id)
      if (!existing) {
        context.session.flash('error', 'Liste nicht gefunden.')
        return redirect(listsGridUrl(formData))
      }

      let rawValues = readFormFieldValues(LISTS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(listsUpdateSchema, formData)

      if (!parseResult.success) {
        return renderListsError(context, {
          editRow: existing,
          formValues: listFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues, SORTABLE_FIELDS, 'updated_at'),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          status: gridStatus(rawValues),
          pageSize: effectivePageSize,
        })
      }
      let fields = parseResult.value

      let changes: Partial<TableRow<typeof lists>> = { title: fields.title.trim() }
      if (fields.description !== undefined) {
        changes.description = fields.description.trim()
      }
      await db.updateMany(lists, changes, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'lists',
          target_id: id,
          details: { changes },
        })
      }

      context.session.flash('success', 'Liste gespeichert.')

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      return redirect(routes.admin.lists.index.href() + (qs ? '?' + qs : ''))
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        context.session.flash('error', 'Ungültige Listen-ID.')
        return redirect(listsGridUrl(formData))
      }

      let existing = await db.findOne(lists, { where: { id } })
      if (!existing) {
        context.session.flash('error', 'Liste nicht gefunden.')
        return redirect(listsGridUrl(formData))
      }

      try {
        await db.delete(lists, { id })
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          context.logger?.('Delete list failed: ' + String(err))
        }
        context.session.flash('error', 'Liste wird noch verwendet und kann nicht gelöscht werden.')
        return redirect(listsGridUrl(formData))
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'lists',
          target_id: id,
        })
      }

      context.session.flash('success', 'Liste gelöscht.')

      // If the delete emptied the last page, step back to the new last page so
      // the follow-up GET does not land on an empty grid (same contract as the
      // messages grid).
      let rawValues = readFormFieldValues(LISTS_FORM_KEYS, formData)
      let pageSize = getPageSize(context.session, LISTS_PAGE_LIMIT, PAGE_SIZE_KEYS.adminLists)
      let total = await countLists(
        db,
        listsSearchPattern(gridFilter(rawValues)),
        gridStatus(rawValues),
      )
      let offset = gridOffset(rawValues)
      if (offset >= total) {
        offset = total > 0 ? Math.floor((total - 1) / pageSize) * pageSize : 0
      }
      return redirect(listsGridUrl(formData, offset))
    },
  },
})
