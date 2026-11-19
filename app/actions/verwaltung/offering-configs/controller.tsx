import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'

import { redirect } from 'remix/response/redirect'

import { parseId } from '../../../utils/ids.ts'
import { parseOffsetParam } from '../../../utils/query-params.ts'
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
  gridStateOverrides,
} from '../../../utils/grid-state.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import { getPageSize, getPageSizeOverride, PAGE_SIZE_KEYS } from '../../../utils/get-page-size.ts'
import type { PageSizeKey } from '../../../utils/get-page-size.ts'
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
  OFFERING_CONFIGS_SORTABLE_FIELDS,
} from '../../../data/offering-configs-queries.ts'
import { flashError } from '../../../utils/flash.ts'

const OFFERING_CONFIGS_PAGE_SIZE = 15

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

interface OfferingConfigPageData {
  rows: OfferingConfigRow[]
  total: number
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
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
  let pageKey = PAGE_SIZE_KEYS.verwaltungOfferingConfigs
  let effectivePageSize = getPageSize(context.session, OFFERING_CONFIGS_PAGE_SIZE, pageKey)
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let offset = overrides?.offset ?? parseOffsetParam(context.url.searchParams.get('offset'))
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter'))?.trim() || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: OFFERING_CONFIGS_SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

  let listOpts: ListOfferingConfigsOpts = {
    offset,
    pageSize: effectivePageSize + 1,
    column,
    direction,
  }
  if (filter) listOpts.filter = filter

  let [totalRows, rows] = await Promise.all([
    countOfferingConfigs(context.db, { filter }),
    listOfferingConfigs(context.db, listOpts),
  ])
  // The total drives the footer ("Zeige 1-15 von 42") and the page count. It
  // uses the same predicate as the page query, so a filter cannot report a
  // total that disagrees with the rows.
  let hasMore = offset + effectivePageSize < totalRows

  let editingParam =
    overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = parseId(editingParam)
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId !== undefined && editingRowId > 0) {
    editRow = (await getOfferingConfig(context.db, editingRowId)) ?? null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let resourceOptions = await listOfferingConfigResources(context.db)

  return {
    rows,
    total: totalRows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
    pageKey,
    pageSizeOverride,
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
      total={data.total}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      pageKey={data.pageKey}
      pageSizeOverride={data.pageSizeOverride}
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
    {
      init,
      title: 'Angebotskonfigurationen – Verwaltung',
      fullHeight: !data.editRow && !data.creating,
    },
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

/** German day names for validation messages; the panels label the rows with these. */
const OFFERING_CONFIG_DAY_LABELS: Record<string, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
}

interface RulesValidation {
  rules: Record<string, [number, number]>
  /** Per-day message keyed by the day name, so the panel can mark that row. */
  dayErrors: Record<string, string>
}

/**
 * Turns the submitted day fields into the stored rules map and reports what is
 * wrong with every enabled day.
 *
 * The previous version quietly dropped a day whose range was inverted or out of
 * bounds, then failed the whole form with "Mindestens ein Tag muss einen
 * Zeitraum haben" — a message that names no field and is false when other days
 * are valid. Day problems are now attributable to their row, and a form with
 * one invalid day is rejected instead of saving a silently partial week.
 */
function validateRules(parsed: Record<string, string>): RulesValidation {
  let rules: Record<string, [number, number]> = {}
  let dayErrors: Record<string, string> = {}
  for (let day of OFFERING_CONFIG_DAY_KEYS) {
    if (parsed[`${day}_enabled`] !== '1') continue
    let label = OFFERING_CONFIG_DAY_LABELS[day] ?? day
    let rawStart = parsed[`${day}_start`]
    let rawEnd = parsed[`${day}_end`]
    if (!rawStart || !rawEnd) {
      dayErrors[day] = `${label}: Bitte Beginn und Ende wählen.`
      continue
    }
    let start = Number(rawStart)
    let end = Number(rawEnd)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 1440) {
      dayErrors[day] = `${label}: Ungültige Zeit.`
      continue
    }
    if (start >= end) {
      dayErrors[day] = `${label}: Das Ende muss nach dem Beginn liegen.`
      continue
    }
    rules[day] = [start, end]
  }
  return { rules, dayErrors }
}

interface OfferingConfigValidationIssue {
  message: string
  path?: readonly unknown[] | undefined
  code?: string
}

interface OfferingConfigValidationSuccess {
  ok: true
  parsed: Record<string, string>
  resourceId: number
  rules: Record<string, [number, number]>
  /** Submitted field values, so a constraint-violation re-render keeps them. */
  formValues: Record<string, string>
}

interface OfferingConfigValidationFailure {
  ok: false
  status: number
  formValues: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  issues: readonly OfferingConfigValidationIssue[]
}

type OfferingConfigValidation = OfferingConfigValidationSuccess | OfferingConfigValidationFailure

/**
 * One validator for the create and update actions: schema, resource
 * existence/duplicate checks, and the weekly rules.
 *
 * Both actions used to repeat those checks inline, which let their German
 * messages, their status codes and their agent-mode issue paths drift apart.
 * Field-level problems are returned as `fieldErrors` (so the panel can mark the
 * control and link it with aria-describedby); only form-level problems become a
 * banner. `issues` always carries the agent-mode shape (X-Agent-Thread).
 */
async function validateOfferingConfig(
  db: AppContext['db'],
  schema: typeof offeringConfigSchema,
  formData: FormData,
  opts: { excludeId?: number | undefined } = {},
): Promise<OfferingConfigValidation> {
  let formValues = readFormFieldValues(OFFERING_CONFIG_FORM_KEYS_LIST, formData)
  let result = s.parseSafe(schema, formData)
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      formValues,
      fieldErrors: issuesToFieldErrors(result.issues),
      issues: result.issues,
    }
  }

  let parsed = result.value

  let resourceId = Number(parsed.resource_id)
  if (!resourceId || !Number.isFinite(resourceId)) {
    let message = 'Ressource ist erforderlich'
    return {
      ok: false,
      status: 400,
      formValues,
      fieldErrors: { resource_id: message },
      issues: [{ message, path: ['resource_id'] }],
    }
  }

  let resource = await db.findOne(resources, { where: { id: resourceId } })
  if (!resource) {
    let message = 'Ressource nicht gefunden'
    return {
      ok: false,
      status: 404,
      formValues,
      fieldErrors: { resource_id: message },
      issues: [{ message, path: ['resource_id'] }],
    }
  }

  let existing = await db.findOne(offeringConfigs, { where: { resource_id: resourceId } })
  if (existing && Number(existing.id) !== opts.excludeId) {
    let message = 'Diese Ressource hat bereits eine Konfiguration'
    return {
      ok: false,
      status: 400,
      formValues,
      fieldErrors: { resource_id: message },
      issues: [{ message, path: ['resource_id'] }],
    }
  }

  let { rules, dayErrors } = validateRules(parsed)
  let dayErrorEntries = Object.entries(dayErrors)
  let dayIssues = dayErrorEntries.map(([day, message]) => ({ message, path: [day] }))

  if (Object.keys(rules).length === 0) {
    let formError = 'Mindestens ein Tag muss einen Zeitraum haben'
    return {
      ok: false,
      status: 400,
      formValues,
      ...(dayErrorEntries.length > 0 ? { fieldErrors: dayErrors } : {}),
      formError,
      issues: [...dayIssues, { message: formError, path: ['rules'] }],
    }
  }

  if (dayErrorEntries.length > 0) {
    return { ok: false, status: 400, formValues, fieldErrors: dayErrors, issues: dayIssues }
  }

  return { ok: true, parsed, resourceId, rules, formValues }
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
      // the grid (matching the non-field-error contract for missing rows). The
      // route param is a string, so guard before the int4 comparison.
      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return redirect(routes.verwaltung.offeringConfigs.index.href())
      }
      let editRow = (await getOfferingConfig(context.db, id)) ?? null
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
        let validation = await validateOfferingConfig(db, offeringConfigSchema, formData)
        if (!validation.ok) {
          return context.json(
            { status: 'validation_error', issues: validation.issues, threadId },
            { status: validation.status },
          )
        }

        let { parsed: _parsed, resourceId, rules } = validation

        let row: Record<string, unknown>
        try {
          row = await db.create(
            offeringConfigs,
            { resource_id: resourceId, rules },
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
          void logAdminAction(context.db, {
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

      let validation = await validateOfferingConfig(db, offeringConfigSchema, formData)

      if (!validation.ok) {
        let data = await loadOfferingConfigPageData(context, {
          creating: true,
          formValues: validation.formValues,
          fieldErrors: validation.fieldErrors,
          formError: validation.formError,
          ...gridStateOverrides(gridValues),
        })
        // A validation failure is a client error (guide 09): the panel fragment
        // is rendered at 400 so the frame still swaps it in with the inline
        // errors. Only the agent JSON response uses the validator's status.
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let { parsed, resourceId, rules } = validation

      let row: Record<string, unknown>
      try {
        row = await db.create(
          offeringConfigs,
          {
            resource_id: resourceId,
            rules,
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
            formValues: validation.formValues,
            formError: 'Ressource wurde gelöscht',
            ...gridStateOverrides(gridValues),
          })
          return renderOfferingConfigPage(context, data, { status: 400 })
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        void logAdminAction(context.db, {
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
      return redirect(baseUrl + '?' + params.toString(), 303)
    },

    async update(context) {
      let db = context.db
      let formData = context.formData
      let gridValues = gridStateFromFormData(formData)

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        flashError(context.session, 'Ungültige ID.')
        return redirect(offeringConfigsGridUrl(formData), 303)
      }

      let target = await db.findOne(offeringConfigs, { where: { id } })
      if (!target) {
        flashError(context.session, 'Eintrag nicht gefunden.')
        return redirect(offeringConfigsGridUrl(formData), 303)
      }

      // The panel is the only caller, so a rejected edit must re-render that
      // same panel with inline errors — a redirect would drop the user's input.
      // Update keeps 400 for a vanished resource (the row itself still exists);
      // only create answers 404 for it, matching its agent-mode contract.
      let validation = await validateOfferingConfig(db, offeringConfigSchema, formData, {
        excludeId: id,
      })

      if (!validation.ok) {
        let data = await loadOfferingConfigPageData(context, {
          editRow: toOfferingConfigRow(target as Record<string, unknown>),
          formValues: validation.formValues,
          fieldErrors: validation.fieldErrors,
          formError: validation.formError,
          ...gridStateOverrides(gridValues),
        })
        return renderOfferingConfigPage(context, data, { status: 400 })
      }

      let { parsed, resourceId, rules } = validation

      try {
        await db.updateMany(offeringConfigs, { resource_id: resourceId, rules }, { where: { id } })
      } catch (error) {
        if (isConstraintViolation(error)) {
          if (process.env.NODE_ENV !== 'test')
            context.logger?.(
              'Constraint violation during offering config update: ' +
                JSON.stringify({ code: (error as { code?: string }).code }),
            )
          let data = await loadOfferingConfigPageData(context, {
            editRow: toOfferingConfigRow(target as Record<string, unknown>),
            formValues: validation.formValues,
            formError: 'Ressource wurde gelöscht',
            ...gridStateOverrides(gridValues),
          })
          return renderOfferingConfigPage(context, data, { status: 400 })
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        void logAdminAction(context.db, {
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
      return redirect(baseUrl + (qs ? '?' + qs : ''), 303)
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        flashError(context.session, 'Ungültige ID.')
        return redirect(offeringConfigsGridUrl(formData), 303)
      }

      let existing = await db.findOne(offeringConfigs, { where: { id } })
      if (!existing) {
        flashError(context.session, 'Eintrag nicht gefunden.')
        return redirect(offeringConfigsGridUrl(formData), 303)
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
          flashError(
            context.session,
            'Konfiguration wird noch verwendet und kann nicht gelöscht werden',
          )
          return redirect(offeringConfigsGridUrl(formData), 303)
        }
        throw error
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        void logAdminAction(context.db, {
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
      return redirect(baseUrl + (qs ? '?' + qs : ''), 303)
    },
  },
})
