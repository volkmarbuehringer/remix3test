import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'

import { redirect } from 'remix/response/redirect'

import { parseId } from '../../../utils/ids.ts'
import { isConstraintViolation } from '../../../utils/db-errors.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { offeringConfigs, resources } from '../../../data/schema.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { parseSort } from '../../../utils/sort-params.ts'
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
import { getPageSize } from '../../../utils/get-page-size.ts'
import { readAgentPrefill } from '../../../utils/agent-prefill.ts'

import { AdminOfferingConfigsPage } from '../../../ui/admin-offering-configs-page.tsx'

// ═══════════════════════════════════════════════════════════════════
// Offering Configs
// ═══════════════════════════════════════════════════════════════════

import type {
  OfferingConfigRow,
  OfferingConfigResourceOption,
  ListOfferingConfigsOpts,
} from '../../../data/offering-configs-queries.ts'
import {
  countOfferingConfigs,
  listOfferingConfigs,
  getOfferingConfig,
  listOfferingConfigResources,
  toOfferingConfigRow,
} from '../../../data/offering-configs-queries.ts'

const OFFERING_CONFIGS_PAGE_SIZE = 15

const OFFERING_CONFIGS_SORTABLE_FIELDS = [
  'id',
  'resource_description',
  'created_at',
  'updated_at',
] as const

const OFFERING_CONFIG_FORM_KEYS_LIST = [
  'resource_id',
  'monday_enabled',
  'monday_start',
  'monday_end',
  'tuesday_enabled',
  'tuesday_start',
  'tuesday_end',
  'wednesday_enabled',
  'wednesday_start',
  'wednesday_end',
  'thursday_enabled',
  'thursday_start',
  'thursday_end',
  'friday_enabled',
  'friday_start',
  'friday_end',
  'saturday_enabled',
  'saturday_start',
  'saturday_end',
  'sunday_enabled',
  'sunday_start',
  'sunday_end',
] as const

const OFFERING_CONFIGS_ORDER_BY_COLUMNS: Record<string, string> = {
  id: 'oc.id',
  resource_description: 'r.name',
  created_at: 'oc.created_at',
  updated_at: 'oc.updated_at',
}

interface OfferingConfigPageData {
  rows: OfferingConfigRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow: OfferingConfigRow | null
  creating: boolean
  resources: OfferingConfigResourceOption[]
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

async function loadOfferingConfigPageData(
  context: Pick<AppContext, 'db' | 'session' | 'url'>,
  overrides?: {
    creating?: boolean | undefined
    editRow?: OfferingConfigRow | null | undefined
    formValues?: Record<string, string> | undefined
    fieldErrors?: Record<string, string> | undefined
    formError?: string | undefined
    offset?: number | undefined
    sortColumn?: string | undefined
    sortDirection?: 'asc' | 'desc' | undefined
    filter?: string | undefined
  },
): Promise<OfferingConfigPageData> {
  let effectivePageSize = getPageSize(context.session, OFFERING_CONFIGS_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: OFFERING_CONFIGS_SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

  let totalRows = await countOfferingConfigs(context.db, { filter })

  let listOpts: ListOfferingConfigsOpts = {
    offset,
    pageSize: effectivePageSize + 1,
    column,
    direction,
    orderByColumns: OFFERING_CONFIGS_ORDER_BY_COLUMNS,
  }
  if (filter) listOpts.filter = filter

  let rows = await listOfferingConfigs(context.db, listOpts)
  let hasMore = offset + effectivePageSize < totalRows

  let editingParam =
    overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam ? Number(editingParam) : null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId && Number.isFinite(editingRowId)) {
    editRow = (await getOfferingConfig(context.db, editingRowId)) ?? null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let resourceOptions = await listOfferingConfigResources(context.db)

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
    resources: resourceOptions,
    formValues: overrides?.formValues,
    fieldErrors: overrides?.fieldErrors,
    formError: overrides?.formError,
  }
}

function renderOfferingConfigPage(
  context: { render: AppContext['render'] },
  data: OfferingConfigPageData,
  init?: ResponseInit,
): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminOfferingConfigsPage
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
      resources={data.resources}
      formValues={data.formValues}
      fieldErrors={data.fieldErrors}
      formError={data.formError}
    />,
    init,
  )
}

/** Builds the offering-configs grid index URL from the submitted grid-state form fields. */
function offeringConfigsGridUrl(formData: FormData): string {
  let params = gridStateToParams(gridStateFromFormData(formData))
  let qs = params.toString()
  return routes.verwaltung.offeringConfigs.index.href() + (qs ? '?' + qs : '')
}

const offeringConfigSchema = f.object({
  resource_id: f.field(s.string()),
  monday_enabled: f.field(s.defaulted(s.string(), '')),
  monday_start: f.field(s.defaulted(s.string(), '')),
  monday_end: f.field(s.defaulted(s.string(), '')),
  tuesday_enabled: f.field(s.defaulted(s.string(), '')),
  tuesday_start: f.field(s.defaulted(s.string(), '')),
  tuesday_end: f.field(s.defaulted(s.string(), '')),
  wednesday_enabled: f.field(s.defaulted(s.string(), '')),
  wednesday_start: f.field(s.defaulted(s.string(), '')),
  wednesday_end: f.field(s.defaulted(s.string(), '')),
  thursday_enabled: f.field(s.defaulted(s.string(), '')),
  thursday_start: f.field(s.defaulted(s.string(), '')),
  thursday_end: f.field(s.defaulted(s.string(), '')),
  friday_enabled: f.field(s.defaulted(s.string(), '')),
  friday_start: f.field(s.defaulted(s.string(), '')),
  friday_end: f.field(s.defaulted(s.string(), '')),
  saturday_enabled: f.field(s.defaulted(s.string(), '')),
  saturday_start: f.field(s.defaulted(s.string(), '')),
  saturday_end: f.field(s.defaulted(s.string(), '')),
  sunday_enabled: f.field(s.defaulted(s.string(), '')),
  sunday_start: f.field(s.defaulted(s.string(), '')),
  sunday_end: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const OFFERING_CONFIG_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

function rulesFromParsed(parsed: Record<string, string>): Record<string, [number, number]> {
  let rules: Record<string, [number, number]> = {}
  for (let day of OFFERING_CONFIG_DAY_KEYS) {
    let enabled = parsed[`${day}_enabled`]
    if (enabled !== '1') continue
    let start = parsed[`${day}_start`]
    let end = parsed[`${day}_end`]
    if (start && end) {
      let startMin = Number(start)
      let endMin = Number(end)
      if (
        Number.isFinite(startMin) &&
        Number.isFinite(endMin) &&
        startMin >= 0 &&
        endMin <= 1440 &&
        startMin < endMin
      ) {
        rules[day] = [startMin, endMin]
      }
    }
  }
  return rules
}

interface CreateValidationSuccess {
  ok: true
  parsed: Record<string, string>
  resourceId: number
  rules: Record<string, [number, number]>
}

interface CreateValidationFailure {
  ok: false
  status: number
  formValues: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  issues?: readonly { path: readonly string[]; message: string; code?: string | undefined }[] | undefined
}

type CreateValidationResult = CreateValidationSuccess | CreateValidationFailure

async function validateCreate(
  db: AppContext['db'],
  schema: typeof offeringConfigSchema,
  formData: FormData,
): Promise<CreateValidationResult> {
  let result = s.parseSafe(schema, formData)
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      formValues: readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData),
      fieldErrors: issuesToFieldErrors(result.issues),
      issues: result.issues as unknown as CreateValidationFailure['issues'],
    }
  }

  let parsed = result.value
  let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)

  let resourceId = Number(parsed.resource_id)
  if (!resourceId || !Number.isFinite(resourceId)) {
    return { ok: false, status: 400, formValues, formError: 'Ressource ist erforderlich' }
  }

  let resource = await db.findOne(resources, { where: { id: resourceId } })
  if (!resource) {
    return { ok: false, status: 404, formValues, formError: 'Ressource nicht gefunden' }
  }

  let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
  if (existing) {
    return {
      ok: false,
      status: 400,
      formValues,
      formError: 'Diese Ressource hat bereits eine Konfiguration',
    }
  }

  let rules = rulesFromParsed(parsed)
  if (Object.keys(rules).length === 0) {
    return {
      ok: false,
      status: 400,
      formValues,
      formError: 'Mindestens ein Tag muss einen Zeitraum haben',
    }
  }

  return { ok: true, parsed, resourceId, rules }
}

export default createController(routes.verwaltung.offeringConfigs, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let prefill = readAgentPrefill(context.request)
      let overrides = prefill ? { formValues: prefill, creating: true } : undefined
      let data = await loadOfferingConfigPageData(context, overrides)
      return renderOfferingConfigPage(context, data)
    },

    async show(context) {
      // Raw /:id renders the edit panel — the frame commits this path as its
      // address after a PUT/DELETE, so it must be a valid GET. After a delete
      // the row is gone, so rather than surfacing a 404 card we PRG back to
      // the grid (matching the non-field-error contract for missing rows).
      let editRow = (await getOfferingConfig(context.db, Number(context.params.id))) ?? null
      if (!editRow) {
        return redirect(routes.verwaltung.offeringConfigs.index.href())
      }
      let data = await loadOfferingConfigPageData(context, { editRow })
      return renderOfferingConfigPage(context, data)
    },

    async create(context) {
      let db = context.db
      let formData = context.formData

      let threadId = context.request.headers.get('X-Agent-Thread')
      if (threadId) {
        let validation = await validateCreate(db, offeringConfigSchema, formData)
        if (!validation.ok) {
          let issues = validation.issues
            ? validation.issues
            : [{ message: validation.formError!, path: ['resource_id'] as const }]
          return context.json(
            { status: 'validation_error', issues, threadId },
            { status: validation.status },
          )
        }

        let { parsed: _parsed, resourceId, rules } = validation

        let row: Record<string, unknown>
        try {
          row = await db.create(
            offeringConfigs,
            { resource_id: resourceId, rules: JSON.stringify(rules) },
            { returnRow: true },
          )
        } catch (error) {
          if (isConstraintViolation(error)) {
            if (process.env.NODE_ENV !== 'test')
              context.logger?.(
                'Constraint violation during offering config creation: ' +
                  JSON.stringify({ code: (error as { code?: string }).code }),
              )
            return context.json(
              {
                status: 'validation_error',
                issues: [{ message: 'Ressource wurde gelöscht', path: ['resource_id'] }],
                threadId,
              },
              { status: 409 },
            )
          }
          throw error
        }

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'create',
            target_type: 'offering_configs',
            target_id: row.id as number,
            details: { resource_id: resourceId, rules },
          })
        }

        return context.json({
          status: 'created',
          data: { id: row.id, resource_id: resourceId, rules },
          threadId,
        })
      }

      let gridValues = gridStateFromFormData(formData)

      let validation = await validateCreate(db, offeringConfigSchema, formData)

      if (!validation.ok) {
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues: validation.formValues,
          fieldErrors: validation.fieldErrors,
          formError: validation.formError,
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      let { parsed, resourceId, rules } = validation

      let row: Record<string, unknown>
      try {
        row = await db.create(
          offeringConfigs,
          {
            resource_id: resourceId,
            rules: JSON.stringify(rules),
          },
          { returnRow: true },
        )
      } catch (error) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test')
            context.logger?.(
              'Constraint violation during offering config creation: ' +
                JSON.stringify({ code: (error as { code?: string }).code }),
            )
          let data = await loadOfferingConfigPageData(context, {
            creating: true,
            formValues: readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData),
            formError: 'Ressource wurde gelöscht',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingConfigPage(context, data)
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'offering_configs',
          target_id: row.id as number,
          details: { resource_id: resourceId, rules },
        })
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let baseUrl = routes.verwaltung.offeringConfigs.index.href()
      return redirect(baseUrl + '?' + params.toString())
    },

    async update(context) {
      let db = context.db
      let formData = context.formData
      let gridValues = gridStateFromFormData(formData)

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        context.session.flash('error', 'Ungültige ID.')
        return redirect(offeringConfigsGridUrl(formData))
      }

      let target = await db.findOne(offeringConfigs, { where: { id } })
      if (!target) {
        context.session.flash('error', 'Eintrag nicht gefunden.')
        return redirect(offeringConfigsGridUrl(formData))
      }

      let result = s.parseSafe(offeringConfigSchema, formData)

      if (!result.success) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let fieldErrors = issuesToFieldErrors(result.issues)
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues,
          fieldErrors,
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      let parsed = result.value

      let resourceId = Number(parsed.resource_id)
      if (!resourceId || !Number.isFinite(resourceId)) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues,
          fieldErrors: { resource_id: 'Ressource ist erforderlich' },
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      let resource = await db.findOne(resources, { where: { id: resourceId } })
      if (!resource) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues,
          formError: 'Ressource nicht gefunden',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
      if (existing && Number(existing.id) !== id) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues,
          formError: 'Diese Ressource hat bereits eine Konfiguration',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      let rules = rulesFromParsed(parsed)
      if (Object.keys(rules).length === 0) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues,
          formError: 'Mindestens ein Tag muss einen Zeitraum haben',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data)
      }

      try {
        await db.updateMany(
          offeringConfigs,
          { resource_id: resourceId, rules: JSON.stringify(rules) },
          { where: { id } },
        )
      } catch (error) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test')
            context.logger?.(
              'Constraint violation during offering config update: ' +
                JSON.stringify({ code: (error as { code?: string }).code }),
            )
          let data = await loadOfferingConfigPageData(context, {
            editRow: toOfferingConfigRow(target as Record<string, unknown>),
            formValues: readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData),
            formError: 'Ressource wurde gelöscht',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingConfigPage(context, data)
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'offering_configs',
          target_id: id,
          details: { resource_id: resourceId, rules },
        })
      }

      let redirectState = gridStateFromForm(parsed)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.verwaltung.offeringConfigs.index.href()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        context.session.flash('error', 'Ungültige ID.')
        return redirect(offeringConfigsGridUrl(formData))
      }

      let existing = await db.findOne(offeringConfigs, { where: { id } })
      if (!existing) {
        context.session.flash('error', 'Eintrag nicht gefunden.')
        return redirect(offeringConfigsGridUrl(formData))
      }

      try {
        await db.deleteMany(offeringConfigs, { where: { id } })
      } catch (error: unknown) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test')
            context.logger?.(
              'Constraint violation during offering config deletion: ' +
                JSON.stringify({ code: (error as { code?: string }).code }),
            )
          context.session.flash(
            'error',
            'Konfiguration wird noch verwendet und kann nicht gelöscht werden',
          )
          return redirect(offeringConfigsGridUrl(formData))
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'offering_configs',
          target_id: id,
        })
      }

      let redirectState = gridStateFromFormData(formData)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.verwaltung.offeringConfigs.index.href()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },
  },
})
