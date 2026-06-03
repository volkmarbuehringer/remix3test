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
  gridStateFromFormData,
  gridStateToParams,
  gridStateOffset,
  gridStateSort,
  gridStateDirection,
  gridStateFilter,
  type GridState,
} from '../utils/grid-state.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { pool } from '../data/setup.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'
import { isConstraintViolation } from '../utils/db-errors.ts'

type Row = Resource

const PAGE_SIZE = 15

const RESOURCE_FORM_KEYS = ['description'] as const

const SORTABLE_FIELDS = ['id', 'description', 'created_at', 'updated_at'] as const

interface ResourcePageData {
  rows: Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: Row | null
  creating?: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadResourcePageData(
  context: AppContext,
  overrides?: Partial<Pick<ResourcePageData, 'creating' | 'editRow' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<ResourcePageData> {
  let db = context.db
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let pageNum = Math.floor(offset / PAGE_SIZE) + 1
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
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

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam ? Number(editingParam) : null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId && Number.isFinite(editingRowId)) {
    editRow = (await db.findOne(resources, { where: { id: editingRowId } })) as Row | null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - PAGE_SIZE),
    nextOffset: offset + PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    editRow,
    creating,
    formValues: overrides?.formValues,
    fieldErrors: overrides?.fieldErrors,
    formError: overrides?.formError,
  }
}

const resourceSaveSchema = f.object({
  description: f.field(s.string().refine((v) => v.length >= 8, 'Beschreibung muss mindestens 8 Zeichen lang sein')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

function renderResourcePage(context: AppContext, data: ResourcePageData, init?: ResponseInit): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminResourcesPage
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      editRow={data.editRow}
      creating={data.creating}
      formValues={data.formValues}
      fieldErrors={data.fieldErrors}
      formError={data.formError}
    />,
    init,
  )
}

export default createController<typeof routes.verwaltung.resources, AppContext>(routes.verwaltung.resources, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let data = await loadResourcePageData(context)
      return renderResourcePage(context, data)
    },

    async create(context) {
      let db = context.db
      let formData = context.formData
      let gridValues = gridStateFromFormData(formData)

      let result = s.parseSafe(resourceSaveSchema, formData)

      if (!result.success) {
        let formValues = readFormFieldValues(RESOURCE_FORM_KEYS, formData)
        let fieldErrors = issuesToFieldErrors(result.issues)
        let data = await loadResourcePageData(context, {
          creating: true,
          formValues,
          fieldErrors,
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderResourcePage(context, data, { status: 400 })
      }

      let parsed = result.value as Record<string, string>

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

      let params = gridStateToParams(gridStateFromForm(parsed))
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
      let gridValues = gridStateFromFormData(formData)

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let result = s.parseSafe(resourceSaveSchema, formData)

      if (!result.success) {
        let formValues = readFormFieldValues(RESOURCE_FORM_KEYS, formData)
        let fieldErrors = issuesToFieldErrors(result.issues)
        let editRow = (await db.findOne(resources, { where: { id } })) as Row | null
        let data = await loadResourcePageData(context, {
          editRow,
          formValues,
          fieldErrors,
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderResourcePage(context, data, { status: 400 })
      }

      let parsed = result.value as Record<string, string>

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

      let params = gridStateToParams(gridStateFromForm(parsed))
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
        if (isConstraintViolation(error)) {
          console.error('Constraint violation during resource deletion', { code: (error as { code?: string }).code, resourceId: id })
          let gridValues = gridStateFromFormData(formData)
          let data = await loadResourcePageData(context, {
            formError: 'Ressource wird noch verwendet und kann nicht gelöscht werden',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderResourcePage(context, data, { status: 400 })
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

      let result = s.parseSafe(resourceSaveSchema, formData)
      let parsed = (result.success ? result.value : { description: '', _offset: '', _sort: '', _order: '', _filter: '' }) as Record<string, string>
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
