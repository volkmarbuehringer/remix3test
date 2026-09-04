import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import type { Database, TableRow } from 'remix/data-table'

import { parseId } from '../../../utils/ids.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { lists } from '../../../data/schema.ts'
import { searchLists, toListRow, type ListRow } from '../../../data/admin-lists.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
} from '../../../utils/grid-state.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { renderGridFormError, type AdminGridErrorState } from '../../../ui/admin-grid-error.tsx'
import { AdminListsPage } from '../../../ui/admin-lists-page.tsx'

const LISTS_PAGE_LIMIT = 10

const SORTABLE_FIELDS = ['id', 'title', 'description', 'created_at', 'updated_at'] as const

type ListSortColumn = (typeof SORTABLE_FIELDS)[number]

const LISTS_FORM_KEYS = ['title', 'description', '_offset', '_sort', '_order', '_filter'] as const

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

function gridOffset(raw: Record<string, string>): number {
  return Math.max(0, Number(raw._offset) || 0)
}

function gridSortColumn(raw: Record<string, string>): string {
  let col = raw._sort
  return col && (SORTABLE_FIELDS as readonly string[]).includes(col) ? col : 'created_at'
}

function gridSortDirection(raw: Record<string, string>): 'asc' | 'desc' {
  return raw._order === 'desc' ? 'desc' : 'asc'
}

function gridFilter(raw: Record<string, string>): string | undefined {
  return raw._filter || undefined
}

function listsGridUrl(formData: FormData): string {
  let params = gridStateToParams(gridStateFromFormData(formData))
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
    pageSize: number
  },
): Promise<{ rows: ListRow[]; hasMore: boolean }> {
  let limit = opts.pageSize + 1
  if (opts.filter) {
    let filter = opts.filter.length > 200 ? opts.filter.slice(0, 200) : opts.filter
    let esc = filter.replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${esc}%`
    let rows = await searchLists(db, searchPattern, limit, opts.offset, opts.column, opts.direction)
    let hasMore = rows.length > opts.pageSize
    if (hasMore) rows.pop()
    return { rows, hasMore }
  }
  let rows = (await db.findMany(lists, {
    limit,
    offset: opts.offset,
    orderBy: [
      [opts.column as ListSortColumn, opts.direction],
      ['id', 'desc'],
    ] as const,
  })).map(toListRow)
  let hasMore = rows.length > opts.pageSize
  if (hasMore) rows.pop()
  return { rows, hasMore }
}

type ListsRenderContext = {
  db: Database
  render: Parameters<typeof renderAdminPage>[0]
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
  return renderGridFormError<ListRow>({
    render: context.render,
    activeItem: 'lists',
    loadRows: () =>
      loadGridData(context.db, {
        offset: opts.offset,
        column: opts.column,
        direction: opts.direction,
        filter: opts.filter,
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

export default createController(routes.admin.lists, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let effectivePageSize = getPageSize(context.session, LISTS_PAGE_LIMIT)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'created_at',
        defaultDirection: 'desc',
      })

      let { rows, hasMore } = await loadGridData(context.db, {
        offset,
        column,
        direction,
        filter,
        pageSize: effectivePageSize,
      })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: ListRow | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        let found = await context.db.findOne(lists, { where: { id: editingRowId } })
        if (found) editRow = toListRow(found)
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
          editRow={editRow}
          creating={creating}
          pageSize={effectivePageSize}
        />,
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, LISTS_PAGE_LIMIT)

      let rawValues = readFormFieldValues(LISTS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(listsCreateSchema, formData)

      if (!parseResult.success) {
        return renderListsError(context, {
          creating: true,
          formValues: listFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
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

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      return redirect(routes.admin.lists.index.href() + '?' + params.toString())
    },

    async update(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, LISTS_PAGE_LIMIT)

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

      let rawValues = readFormFieldValues(LISTS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(listsUpdateSchema, formData)

      if (!parseResult.success) {
        return renderListsError(context, {
          editRow: toListRow(existing),
          formValues: listFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
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

      let params = gridStateToParams(gridStateFromFormData(formData))
      let qs = params.toString()
      return redirect(routes.admin.lists.index.href() + (qs ? '?' + qs : ''))
    },
  },
})
