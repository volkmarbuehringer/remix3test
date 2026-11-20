import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { isConstraintViolation, isExclusionConstraintError } from '../../../utils/db-errors.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { parseId } from '../../../utils/ids.ts'
import { parseOffsetParam } from '../../../utils/query-params.ts'
import { isDateInPast } from '../../../utils/date-utils.ts'
import Holidays from 'date-holidays'
import { offeringSaveSchema, OFFERING_FORM_KEYS } from '../../../utils/offering-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import {
  editingRedirect,
  gridStateFromFormData,
  gridStateToParams,
  gridStateOverrides,
} from '../../../utils/grid-state.ts'
import { getAdminIdentity } from '../../../utils/context.ts'

import { AdminOfferingsPage } from '../../../ui/admin-offerings-page.tsx'
import { getConfig, upsertConfig, generateWeek } from '../../../data/offering-configs.ts'
import type { OfferingConfig } from '../../../data/offering-configs.ts'
import { getPageSize, getPageSizeOverride, PAGE_SIZE_KEYS } from '../../../utils/get-page-size.ts'
import type { PageSizeKey } from '../../../utils/get-page-size.ts'

import {
  listOfferings,
  fetchOfferingEditRow,
  listResources,
  createOffering,
  updateOffering,
  deleteOffering,
  listResourceIdsWithConfigs,
  deletePastOfferings,
  countPastOfferings,
} from '../../../data/offerings-queries.ts'
import type { OfferingRow, OfferingsResourceOption } from '../../../data/offerings-queries.ts'
import { flashError, flashSuccess } from '../../../utils/flash.ts'

const hd = new Holidays('DE', 'rp')

// ═══════════════════════════════════════════════════════════════════
// Offerings
// ═══════════════════════════════════════════════════════════════════

const OFFERINGS_PAGE_SIZE = 12

const OFFERINGS_SORTABLE_FIELDS = [
  'ao.id',
  'ao.day',
  'ao.resource_id',
  'r.description',
  'ao.during',
  'ao.created_at',
  'ao.updated_at',
] as const

interface OfferingPageData {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period: string | undefined
  status: string | undefined
  editRow: OfferingRow | null
  creating: boolean
  resources: OfferingsResourceOption[]
  error: string | undefined
  configResourceId: number | undefined
  offeringConfig: OfferingConfig | undefined
  addWeek: boolean
  pastCount: number
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

type Undefinable<T> = { [K in keyof T]: T[K] | undefined }

async function loadOfferingPageData(
  context: Pick<AppContext, 'db' | 'session' | 'url'>,
  overrides?: Undefinable<
    Partial<
      Pick<
        OfferingPageData,
        | 'creating'
        | 'editRow'
        | 'error'
        | 'formValues'
        | 'fieldErrors'
        | 'formError'
        | 'offset'
        | 'sortColumn'
        | 'sortDirection'
        | 'filter'
        | 'period'
        | 'status'
      >
    >
  >,
): Promise<OfferingPageData> {
  let pageKey = PAGE_SIZE_KEYS.verwaltungOfferings
  let effectivePageSize = getPageSize(context.session, OFFERINGS_PAGE_SIZE, pageKey)
  let pageSizeOverride = getPageSizeOverride(context.session, pageKey)
  let offset = overrides?.offset ?? parseOffsetParam(context.url.searchParams.get('offset'))
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: OFFERINGS_SORTABLE_FIELDS,
        defaultColumn: 'ao.day',
        defaultDirection: 'asc',
      })

  let [{ rows, hasMore }, resourceOptions, pastCount] = await Promise.all([
    listOfferings(context.db, {
      offset,
      pageSize: effectivePageSize,
      column,
      direction,
      filter,
      period,
      status,
    }),
    listResources(context.db),
    countPastOfferings(context.db),
  ])

  let editingParam =
    overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = parseId(editingParam)
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId !== undefined && editingRowId > 0) {
    editRow = await fetchOfferingEditRow(context.db, String(editingRowId))
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let error = (overrides?.error ?? context.url.searchParams.get('error')) || undefined
  let formValues = overrides?.formValues ?? undefined
  let fieldErrors = overrides?.fieldErrors ?? undefined
  let formError = overrides?.formError ?? undefined

  let configResourceId = parseId(context.url.searchParams.get('config'))
  let addWeek = context.url.searchParams.get('addweek') === 'true'

  let offeringConfig: OfferingConfig | null = null
  if (configResourceId !== undefined && configResourceId > 0) {
    offeringConfig = await getConfig(context.db, configResourceId)
  }

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
    pageKey,
    pageSizeOverride,
    sortColumn: column,
    sortDirection: direction,
    filter,
    period,
    status,
    editRow,
    creating,
    resources: resourceOptions,
    error,
    configResourceId:
      configResourceId !== undefined && configResourceId > 0 ? configResourceId : undefined,
    offeringConfig: offeringConfig ?? undefined,
    addWeek,
    pastCount,
    formValues,
    fieldErrors,
    formError,
  }
}

function renderOfferingsPage(
  context: { render: AppContext['render'] },
  data: OfferingPageData,
  init?: ResponseInit,
): Response {
  return renderVerwaltungPage(context.render, <AdminOfferingsPage {...data} />, {
    init,
    title: 'Angebote – Verwaltung',
    fullHeight: !data.editRow && !data.creating,
  })
}

/** Builds the offerings grid index URL from the submitted grid-state form fields. */
function offeringsGridUrl(formData: FormData): string {
  let params = gridStateToParams(gridStateFromFormData(formData))
  let qs = params.toString()
  return routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '')
}

const OFFERING_OVERLAP_ERROR = 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.'

interface ValidatedOffering {
  resource_id: number
  day: string
  dayMs: number
  during: string
}

/** A validation failure always carries at least one message (field-level or form-level). */
type OfferingFormError =
  | { fieldErrors: Record<string, string>; formError?: string }
  | { formError: string }

/**
 * Shared validation chain for the create and update actions: schema parse,
 * end-after-start, holiday, and past-date checks run in the same order with
 * the same messages. The exclusion-constraint check can only run after the
 * write — both actions catch it and surface {@link OFFERING_OVERLAP_ERROR}.
 */
function validateOfferingForm(
  formData: FormData,
): { ok: true; value: ValidatedOffering } | { ok: false; error: OfferingFormError } {
  let result = s.parseSafe(offeringSaveSchema, formData)
  if (!result.success) {
    return { ok: false, error: { fieldErrors: issuesToFieldErrors(result.issues) } }
  }

  let { resource_id, day, start_min, end_min } = result.value

  if (end_min <= start_min) {
    return {
      ok: false,
      error: {
        fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
        formError: 'muss nach der Startzeit liegen.',
      },
    }
  }

  let dayMs = new Date(day + 'T00:00:00Z').getTime()

  if (hd.isHoliday(new Date(dayMs))) {
    return { ok: false, error: { formError: 'Dieses Datum ist ein Feiertag.' } }
  }

  if (isDateInPast(dayMs)) {
    return {
      ok: false,
      error: {
        formError: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
      },
    }
  }

  return { ok: true, value: { resource_id, day, dayMs, during: `[${start_min},${end_min})` } }
}

type OfferingAuditEntry = Omit<
  Parameters<typeof logAdminAction>[1],
  'admin_user_id' | 'admin_email'
>

/** Fire-and-forget audit trail entry, attributed to the acting admin when present. */
function logOfferingAction(
  context: Pick<AppContext, 'db' | 'auth'>,
  entry: OfferingAuditEntry,
): void {
  let authIdentity = getAdminIdentity(context.auth)
  if (authIdentity) {
    void logAdminAction(context.db, {
      admin_user_id: authIdentity.id,
      admin_email: authIdentity.email,
      ...entry,
    })
  }
}

export default createController(routes.verwaltung.offerings, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let data = await loadOfferingPageData(context)
      return renderOfferingsPage(context, data)
    },

    async create(context) {
      let formData = context.formData
      let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
      let gridValues = gridStateFromFormData(formData)

      let validated = validateOfferingForm(formData)
      if (!validated.ok) {
        let data = await loadOfferingPageData(context, {
          creating: true,
          formValues,
          ...validated.error,
          ...gridStateOverrides(gridValues),
        })
        return renderOfferingsPage(context, data, { status: 400 })
      }

      let { resource_id, day, dayMs, during } = validated.value
      let newId: number

      try {
        newId = await createOffering(context.db, { dayMs, resourceId: resource_id, during })

        logOfferingAction(context, {
          action_type: 'create',
          target_type: 'appointoffering',
          target_id: newId,
          details: { resource_id, day, during },
        })
      } catch (error: unknown) {
        if (isExclusionConstraintError(error)) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            formError: OFFERING_OVERLAP_ERROR,
            ...gridStateOverrides(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }
        throw error
      }

      return editingRedirect(routes.verwaltung.offerings.index.href(), newId, gridValues, 303)
    },

    async update(context) {
      let formData = context.formData
      let id = context.params.id
      if (id === undefined || parseId(id) === undefined) {
        flashError(context.session, 'Ungültige ID.')
        return redirect(offeringsGridUrl(formData), 303)
      }

      let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
      let gridValues = gridStateFromFormData(formData)

      let validated = validateOfferingForm(formData)
      if (!validated.ok) {
        let editRow = await fetchOfferingEditRow(context.db, id)
        let data = await loadOfferingPageData(context, {
          editRow,
          formValues,
          ...validated.error,
          ...gridStateOverrides(gridValues),
        })
        return renderOfferingsPage(context, data, { status: 400 })
      }

      let { resource_id, day, dayMs, during } = validated.value

      try {
        let updated = await updateOffering(context.db, id, {
          dayMs,
          resourceId: resource_id,
          during,
        })

        if (!updated) {
          flashError(context.session, 'Eintrag nicht gefunden.')
          return redirect(offeringsGridUrl(formData), 303)
        }

        logOfferingAction(context, {
          action_type: 'update',
          target_type: 'appointoffering',
          target_id: id,
          details: { resource_id, day, during },
        })
      } catch (error: unknown) {
        if (isExclusionConstraintError(error)) {
          let editRow = await fetchOfferingEditRow(context.db, id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            formError: OFFERING_OVERLAP_ERROR,
            ...gridStateOverrides(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }
        throw error
      }

      return redirect(offeringsGridUrl(formData), 303)
    },

    async destroy(context) {
      let id = context.params.id
      let formData = context.formData
      if (id === undefined || parseId(id) === undefined) {
        flashError(context.session, 'Ungültige ID.')
        return redirect(offeringsGridUrl(formData), 303)
      }

      try {
        let deleted = await deleteOffering(context.db, id)

        if (!deleted) {
          flashError(context.session, 'Eintrag nicht gefunden.')
          return redirect(offeringsGridUrl(formData), 303)
        }

        logOfferingAction(context, {
          action_type: 'destroy',
          target_type: 'appointoffering',
          target_id: id,
        })
      } catch (error: unknown) {
        if (isConstraintViolation(error)) {
          flashError(
            context.session,
            'Der Eintrag kann nicht gelöscht werden, da er noch verwendet wird.',
          )
          return redirect(offeringsGridUrl(formData), 303)
        }
        throw error
      }

      return redirect(offeringsGridUrl(formData), 303)
    },

    async configSave(context) {
      let formData = context.formData

      let result = s.parseSafe(
        f.object({
          resource_id: f.field(
            s.string().refine((v) => /^\d+$/.test(v), 'Ressource ist erforderlich.'),
          ),
        }),
        formData,
      )

      if (!result.success) {
        flashError(context.session, result.issues[0]?.message ?? 'Ungültige Anfrage.')
        return redirect(offeringsGridUrl(formData), 303)
      }

      let resourceId = parseInt(result.value.resource_id, 10)

      let DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      let rules: Record<string, [number, number]> = {}
      for (let key of DAY_KEYS) {
        let enabled = formData.get(`${key}_enabled`)
        if (enabled === '1') {
          let startStr = formData.get(`${key}_start`) as string | null
          let endStr = formData.get(`${key}_end`) as string | null
          let start = startStr ? parseInt(startStr, 10) : NaN
          let end = endStr ? parseInt(endStr, 10) : NaN
          if (!isNaN(start) && !isNaN(end)) {
            rules[key] = [start, end]
          }
        }
      }

      await upsertConfig(context.db, resourceId, rules)

      logOfferingAction(context, {
        action_type: 'config_save',
        target_type: 'offering_configs',
        target_id: resourceId,
        details: { rules },
      })

      return redirect(offeringsGridUrl(formData), 303)
    },

    async weekGenerate(context) {
      let formData = context.formData

      let result = s.parseSafe(
        f.object({
          year: f.field(s.string().refine((v) => /^\d+$/.test(v), 'Jahr ist erforderlich.')),
          week: f.field(s.string().refine((v) => /^\d+$/.test(v), 'Woche ist erforderlich.')),
        }),
        formData,
      )

      if (!result.success) {
        flashError(context.session, result.issues[0]?.message ?? 'Ungültige Anfrage.')
        return redirect(offeringsGridUrl(formData), 303)
      }

      let year = parseInt(result.value.year, 10)
      let week = parseInt(result.value.week, 10)

      let resourceIds = await listResourceIdsWithConfigs(context.db)
      let totalCreated = 0
      let totalSkipped = 0
      let allErrors: string[] = []

      for (let resourceId of resourceIds) {
        let weekResult = await generateWeek(context.db, resourceId, year, week)
        totalCreated += weekResult.created
        totalSkipped += weekResult.skipped
        allErrors.push(...weekResult.errors)
      }

      if (allErrors.length > 0) {
        flashError(
          context.session,
          `${totalCreated} erstellt, ${totalSkipped} übersprungen. Fehler: ${allErrors[0]}`,
        )
      } else {
        flashSuccess(
          context.session,
          `${totalCreated} Angebote erstellt${totalSkipped > 0 ? `, ${totalSkipped} übersprungen.` : '.'}`,
        )
      }

      logOfferingAction(context, {
        action_type: 'week_generate',
        target_type: 'appointoffering',
        details: { year, week, totalCreated, totalSkipped },
      })

      return redirect(offeringsGridUrl(formData), 303)
    },

    async deletePast(context) {
      let formData = context.formData

      let count = await deletePastOfferings(context.db)

      logOfferingAction(context, {
        action_type: 'delete_past',
        target_type: 'appointoffering',
        details: { deletedCount: count },
      })

      flashSuccess(context.session, `${count} vergangene Angebote gelöscht.`)
      return redirect(offeringsGridUrl(formData), 303)
    },
  },
})
