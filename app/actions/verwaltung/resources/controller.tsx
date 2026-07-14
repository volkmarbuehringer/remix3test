import { ilike } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength, maxLength } from 'remix/data-schema/checks'
import { createController } from 'remix/router'
import { Logger } from 'remix/middleware/logger'
import { redirect } from 'remix/response/redirect'

import { parseId } from '../../../utils/ids.ts'
import { isConstraintViolation } from '../../../utils/db-errors.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { resources, type Resource } from '../../../data/schema.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { AdminResourcesPage } from '../../../ui/admin-resources-page.tsx'
import { routes } from '../../../routes.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { paginate } from '../../../utils/pagination.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
  gridStateOffset,
  gridStateSort,
  gridStateDirection,
  gridStateFilter,
} from '../../../utils/grid-state.ts'
import { getAdminIdentity } from '../../../utils/context.ts'

// ═══════════════════════════════════════════════════════════════════
// Resources
// ═══════════════════════════════════════════════════════════════════

type ResourceRow = Resource

const RESOURCES_PAGE_SIZE = 15

const RESOURCE_FORM_KEYS = ['name', 'description', 'capabilities'] as const

const RESOURCES_SORTABLE_FIELDS = ['id', 'name', 'description', 'created_at', 'updated_at'] as const

interface ResourcePageData {
  rows: ResourceRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: ResourceRow | null
  creating?: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadResourcePageData(
  context: AppContext,
  overrides?: Partial<
    Pick<
      ResourcePageData,
      | 'creating'
      | 'editRow'
      | 'formValues'
      | 'fieldErrors'
      | 'formError'
      | 'offset'
      | 'sortColumn'
      | 'sortDirection'
      | 'filter'
    >
  >,
): Promise<ResourcePageData> {
  let db = context.db
  let effectivePageSize = getPageSize(context.session, RESOURCES_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let pageNum = Math.floor(offset / effectivePageSize) + 1
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: RESOURCES_SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let filterPredicate = filter && filter.length <= 200 ? ilike('name', `%${filter}%`) : undefined

  let { items: page, hasMore } = await paginate(db, resources, {
    pageSize: effectivePageSize,
    page: pageNum,
    orderBy: [[column, direction]],
    where: filterPredicate as Record<string, unknown>,
  })

  let rows = page as ResourceRow[]

  let editingParam =
    overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam ? Number(editingParam) : null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId && Number.isFinite(editingRowId)) {
    editRow = (await db.findOne(resources, { where: { id: editingRowId } })) as ResourceRow | null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
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
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(4))),
  description: f.field(
    s
      .defaulted(s.string(), '')
      .refine((v) => v.length >= 8, 'Beschreibung muss mindestens 8 Zeichen lang sein'),
  ),
  capabilities: f.field(s.defaulted(s.string(), '').pipe(maxLength(10000))),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

function renderResourcePage(
  context: AppContext,
  data: ResourcePageData,
  init?: ResponseInit,
): Response {
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

export default createController<typeof routes.verwaltung.resources, AppContext>(
  routes.verwaltung.resources,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadResourcePageData(context)
        return renderResourcePage(context, data)
      },

      async create(context) {
        let db = context.db
        let formData = context.formData

        let threadId = context.request.headers.get('X-Agent-Thread')
        if (threadId) {
          let result = s.parseSafe(resourceSaveSchema, formData)
          if (!result.success) {
            return context.json({ status: 'validation_error', issues: result.issues, threadId }, { status: 400 })
          }
          let parsed = result.value as Record<string, string>
          let row = await db.create(
            resources,
            {
              name: parsed.name.trim(),
              description: parsed.description.trim(),
              capabilities: parsed.capabilities.trim(),
            },
            { returnRow: true },
          )
          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(context.db, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'create',
              target_type: 'resources',
              target_id: row.id as number,
              details: {
                name: parsed.name.trim(),
                description: parsed.description.trim(),
                capabilities: parsed.capabilities.trim(),
              },
            })
          }
          return context.json({
            status: 'created',
            data: { id: row.id, name: row.name, description: row.description, capabilities: row.capabilities },
            threadId,
          })
        }

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
          {
            name: parsed.name.trim(),
            description: parsed.description.trim(),
            capabilities: parsed.capabilities.trim(),
          },
          { returnRow: true },
        )

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'create',
            target_type: 'resources',
            target_id: row.id as number,
            details: {
              name: parsed.name.trim(),
              description: parsed.description.trim(),
              capabilities: parsed.capabilities.trim(),
            },
          })
        }

        let params = gridStateToParams(gridStateFromForm(parsed))
        params.set('editing', String(row.id))
        let baseUrl = routes.verwaltung.resources.index.href()
        return redirect(baseUrl + '?' + params.toString())
      },

      async update(context) {
        let db = context.db
        let formData = context.formData
        let gridValues = gridStateFromFormData(formData)

        let id = parseId(context.params.id)
        if (id === undefined || id < 1) {
          return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
        }

        let result = s.parseSafe(resourceSaveSchema, formData)

        if (!result.success) {
          let formValues = readFormFieldValues(RESOURCE_FORM_KEYS, formData)
          let fieldErrors = issuesToFieldErrors(result.issues)
          let editRow = (await db.findOne(resources, { where: { id } })) as ResourceRow | null
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

        await db.updateMany(
          resources,
          {
            name: parsed.name.trim(),
            description: parsed.description.trim(),
            capabilities: parsed.capabilities.trim(),
          },
          { where: { id } },
        )

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'update',
            target_type: 'resources',
            target_id: id,
            details: {
              name: parsed.name.trim(),
              description: parsed.description.trim(),
              capabilities: parsed.capabilities.trim(),
            },
          })
        }

        let params = gridStateToParams(gridStateFromForm(parsed))
        let qs = params.toString()
        let baseUrl = routes.verwaltung.resources.index.href()
        return redirect(baseUrl + (qs ? '?' + qs : ''))
      },

      async destroy(context) {
        let db = context.db
        let formData = context.formData

        let id = parseId(context.params.id)
        if (id === undefined || id < 1) {
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
            if (process.env.NODE_ENV !== 'test')
              context.get(Logger)?.(
                'Constraint violation during resource deletion: ' +
                  JSON.stringify({ code: (error as { code?: string }).code, resourceId: id }),
              )
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

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'destroy',
            target_type: 'resources',
            target_id: id,
          })
        }

        let result = s.parseSafe(resourceSaveSchema, formData)
        let parsed = (
          result.success
            ? result.value
            : { description: '', _offset: '', _sort: '', _order: '', _filter: '' }
        ) as Record<string, string>
        let params = gridStateToParams(gridStateFromForm(parsed))
        let qs = params.toString()
        let baseUrl = routes.verwaltung.resources.index.href()
        return redirect(baseUrl + (qs ? '?' + qs : ''))
      },
    },
  },
)
