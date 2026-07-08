import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { Logger } from 'remix/middleware/logger'
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

import { AdminOfferingConfigsPage } from '../../../ui/admin-offering-configs-page.tsx'

// ═══════════════════════════════════════════════════════════════════
// Offering Configs
// ═══════════════════════════════════════════════════════════════════

import type { OfferingConfigRow, OfferingConfigResourceOption, ListOfferingConfigsOpts } from '../../../data/offering-configs-queries.ts'
import { countOfferingConfigs, listOfferingConfigs, getOfferingConfig, listOfferingConfigResources, toOfferingConfigRow } from '../../../data/offering-configs-queries.ts'

const OFFERING_CONFIGS_PAGE_SIZE = 15

const OFFERING_CONFIGS_SORTABLE_FIELDS = ['id', 'resource_description', 'created_at', 'updated_at'] as const

const OFFERING_CONFIG_FORM_KEYS_LIST = ['resource_id', 'monday_enabled', 'monday_start', 'monday_end', 'tuesday_enabled', 'tuesday_start', 'tuesday_end', 'wednesday_enabled', 'wednesday_start', 'wednesday_end', 'thursday_enabled', 'thursday_start', 'thursday_end', 'friday_enabled', 'friday_start', 'friday_end', 'saturday_enabled', 'saturday_start', 'saturday_end', 'sunday_enabled', 'sunday_start', 'sunday_end'] as const

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
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadOfferingConfigPageData(
  context: AppContext,
  overrides?: Partial<Pick<OfferingConfigPageData, 'creating' | 'editRow' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<OfferingConfigPageData> {
  let effectivePageSize = getPageSize(context.session, OFFERING_CONFIGS_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
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

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam ? Number(editingParam) : null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId && Number.isFinite(editingRowId)) {
    editRow = await getOfferingConfig(context.db, editingRowId) ?? null
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

function renderOfferingConfigPage(context: AppContext, data: OfferingConfigPageData, init?: ResponseInit): Response {
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

const OFFERING_CONFIG_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

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
      if (Number.isFinite(startMin) && Number.isFinite(endMin) && startMin >= 0 && endMin <= 1440 && startMin < endMin) {
        rules[day] = [startMin, endMin]
      }
    }
  }
  return rules
}

export default createController<typeof routes.verwaltung.offeringConfigs, AppContext>(routes.verwaltung.offeringConfigs, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let data = await loadOfferingConfigPageData(context)
      return renderOfferingConfigPage(context, data)
    },

    async create(context) {
      let db = context.db
      let formData = context.formData
      let gridValues = gridStateFromFormData(formData)

      let result = s.parseSafe(offeringConfigSchema, formData)

      if (!result.success) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let fieldErrors = issuesToFieldErrors(result.issues)
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues,
          fieldErrors,
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let parsed = result.value as Record<string, string>

      let resourceId = Number(parsed.resource_id)
      if (!resourceId || !Number.isFinite(resourceId)) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues,
          fieldErrors: { resource_id: 'Ressource ist erforderlich' },
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let resource = await db.findOne(resources, { where: { id: resourceId } })
      if (!resource) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues,
          formError: 'Ressource nicht gefunden',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 404 })
      }

      let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
      if (existing) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues,
          formError: 'Diese Ressource hat bereits eine Konfiguration',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let rules = rulesFromParsed(parsed)
      if (Object.keys(rules).length === 0) {
        let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues,
          formError: 'Mindestens ein Tag muss einen Zeitraum haben',
          offset: gridStateOffset(gridValues),
          sortColumn: gridStateSort(gridValues),
          sortDirection: gridStateDirection(gridValues),
          filter: gridStateFilter(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

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
          if (process.env.NODE_ENV !== 'test') context.get(Logger)?.('Constraint violation during offering config creation: ' + JSON.stringify({ code: (error as { code?: string }).code }))
          let data = await loadOfferingConfigPageData(context, {
            creating: true,
            formValues: readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData),
            formError: 'Ressource wurde gelöscht',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingConfigPage(context, data, { status: 409 })
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
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let target = await db.findOne(offeringConfigs, { where: { id } })
      if (!target) {
        return context.json({ ok: false, error: 'Config not found' }, { status: 404 })
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
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let parsed = result.value as Record<string, string>

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
        return renderOfferingConfigPage(context, data, { status: 400 })
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
        return renderOfferingConfigPage(context, data, { status: 404 })
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
        return renderOfferingConfigPage(context, data, { status: 400 })
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
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      try {
        await db.updateMany(
          offeringConfigs,
          { resource_id: resourceId, rules: JSON.stringify(rules) },
          { where: { id } },
        )
      } catch (error) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test') context.get(Logger)?.('Constraint violation during offering config update: ' + JSON.stringify({ code: (error as { code?: string }).code }))
          let data = await loadOfferingConfigPageData(context, {
            editRow: toOfferingConfigRow(target as Record<string, unknown>),
            formValues: readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData),
            formError: 'Ressource wurde gelöscht',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingConfigPage(context, data, { status: 409 })
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
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let existing = await db.findOne(offeringConfigs, { where: { id } })
      if (!existing) {
        return context.json({ ok: false, error: 'Config not found' }, { status: 404 })
      }

      try {
        await db.deleteMany(offeringConfigs, { where: { id } })
      } catch (error: unknown) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test') context.get(Logger)?.('Constraint violation during offering config deletion: ' + JSON.stringify({ code: (error as { code?: string }).code }))
          let gridValues = gridStateFromFormData(formData)
          let data = await loadOfferingConfigPageData(context, {
            formError: 'Konfiguration wird noch verwendet und kann nicht gelöscht werden',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderOfferingConfigPage(context, data, { status: 400 })
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
