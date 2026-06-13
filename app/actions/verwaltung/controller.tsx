import { ilike } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength } from 'remix/data-schema/checks'
import { createController } from 'remix/router'
import { Logger } from 'remix/middleware/logger'

import { isConstraintViolation, isExclusionConstraintError } from '../../utils/db-errors.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { offeringConfigs, resources, type Resource } from '../../data/schema.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../ui/verwaltung-layout.tsx'
import { VerwaltungDashboardContent } from '../../ui/verwaltung-page.tsx'
import { routes } from '../../routes.ts'
import { pool } from '../../data/setup.ts'
import { isDateInPast, getPeriodRange, getTodayUtcMidnight } from '../../utils/date-utils.ts'
import { isSlotBookable, listOfferingsByDayRange, parseDuring } from '../../data/appointofferings.ts'
import { getConfig, upsertConfig, generateWeek } from '../../data/offering-configs.ts'
import type { OfferingConfig } from '../../data/offering-configs.ts'
import Holidays from 'date-holidays'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { appointmentChannel } from '../../lib/appointments-sse.ts'
import { appointmentSaveSchema, APPOINTMENT_FORM_KEYS } from '../../utils/appointment-schema.ts'
import { offeringSaveSchema, OFFERING_FORM_KEYS } from '../../utils/offering-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { paginate } from '../../utils/pagination.ts'
import { parseSort } from '../../utils/sort-params.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
  gridStateOffset,
  gridStateSort,
  gridStateDirection,
  gridStateFilter,
  gridStatePeriod,
  gridStateStatus,
  type GridState,
} from '../../utils/grid-state.ts'
import { getAdminIdentity } from '../../utils/context.ts'

import { AdminOfferingsPage } from '../../ui/admin-offerings-page.tsx'
import { AdminAppointmentsPage } from '../../ui/admin-appointments-page.tsx'
import { AdminResourcesPage } from '../../ui/admin-resources-page.tsx'
import { AdminOfferingConfigsPage } from '../../ui/admin-offering-configs-page.tsx'
import { AdminReport1Page } from '../../ui/admin-report1-page.tsx'

const hd = new Holidays('DE', 'rp')

// ── Dashboard ──

export default createController(routes.verwaltung, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderVerwaltungPage(context.render, <VerwaltungDashboardContent />)
    },
  },
})

// ═══════════════════════════════════════════════════════════════════
// Offerings
// ═══════════════════════════════════════════════════════════════════

const OFFERINGS_PAGE_SIZE = 12

const OFFERINGS_ORDER_BY_COLUMNS: Record<string, string> = {
  'ao.id': 'ao.id',
  'ao.day': 'ao.day',
  'ao.resource_id': 'ao.resource_id',
  'r.description': 'r.name',
  'ao.during': 'ao.during',
  'ao.created_at': 'ao.created_at',
  'ao.updated_at': 'ao.updated_at',
}

const OFFERINGS_SEARCH_COLUMNS = ['r.name', 'r.description'] as const

export interface OfferingRow {
  id: string
  day: string
  resource_id: string
  resource_name: string | null
  resource_description: string | null
  during: string
  created_at: string
  updated_at: string
}

export interface OfferingsResourceOption {
  id: string
  name: string
  description: string
}

interface OfferingPageData {
  rows: OfferingRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
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
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function fetchOfferingEditRow(id: string): Promise<OfferingRow | null> {
  let result = await pool.query(
    `SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
            ao.during, ao.created_at, ao.updated_at
     FROM appointoffering ao
     LEFT JOIN resources r ON r.id = ao.resource_id
     WHERE ao.id = $1`,
    [id],
  )
  return result.rows.length > 0 ? (result.rows[0] as OfferingRow) : null
}

async function loadOfferingPageData(
  context: AppContext,
  overrides?: Partial<Pick<OfferingPageData, 'creating' | 'editRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'period' | 'status'>>,
): Promise<OfferingPageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: Object.keys(OFFERINGS_ORDER_BY_COLUMNS),
        defaultColumn: 'ao.day',
        defaultDirection: 'asc',
      })

  let query = `
    SELECT ao.id, ao.day, ao.resource_id, r.name AS resource_name, r.description AS resource_description,
           ao.during, ao.created_at, ao.updated_at
    FROM appointoffering ao
    LEFT JOIN resources r ON r.id = ao.resource_id
  `

  let queryParams: unknown[] = []
  let paramIndex = 0

  let hasWhere = false

  if (filter && filter.length <= 200) {
    paramIndex++
    let searchPattern = `%${filter}%`
    let conditions = OFFERINGS_SEARCH_COLUMNS.map(
      (col) => `${col} ILIKE $${paramIndex}`,
    )
    query += ` WHERE (${conditions.join(' OR ')})`
    queryParams.push(searchPattern)
    hasWhere = true
  }

  let periodRange = period ? getPeriodRange(period) : null
  if (periodRange) {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day >= $${paramIndex}`
    } else {
      query += ` WHERE ao.day >= $${paramIndex}`
      hasWhere = true
    }
    queryParams.push(periodRange.startMs)

    paramIndex++
    query += ` AND ao.day < $${paramIndex}`
    queryParams.push(periodRange.endMs)
  }

  let todayMidnight = getTodayUtcMidnight()
  if (status === 'pending' || !status) {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day >= $${paramIndex}`
    } else {
      query += ` WHERE ao.day >= $${paramIndex}`
    }
    queryParams.push(todayMidnight)
  } else if (status === 'expired') {
    paramIndex++
    if (hasWhere) {
      query += ` AND ao.day < $${paramIndex}`
    } else {
      query += ` WHERE ao.day < $${paramIndex}`
    }
    queryParams.push(todayMidnight)
  }

  paramIndex++
  query += ` ORDER BY ${OFFERINGS_ORDER_BY_COLUMNS[column] || 'ao.day'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  queryParams.push(OFFERINGS_PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  queryParams.push(offset)

  let result = await pool.query(query, queryParams)
  let rows = result.rows as OfferingRow[]
  let hasMore = rows.length > OFFERINGS_PAGE_SIZE
  if (hasMore) rows.pop()

  let resourcesResult = await pool.query(
    'SELECT id, name, description FROM resources ORDER BY name ASC',
  )
  let resourceOptions = resourcesResult.rows as OfferingsResourceOption[]

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam || null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = await fetchOfferingEditRow(editingRowId)
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let error = (overrides?.error ?? context.url.searchParams.get('error')) || undefined
  let formValues = overrides?.formValues ?? undefined
  let fieldErrors = overrides?.fieldErrors ?? undefined
  let formError = overrides?.formError ?? undefined

  let configResourceId = context.url.searchParams.get('config')
  let addWeek = context.url.searchParams.get('addweek') === 'true'

  let offeringConfig: OfferingConfig | null = null
  if (configResourceId) {
    let rid = parseInt(configResourceId, 10)
    if (!isNaN(rid)) {
      offeringConfig = await getConfig(context.db, rid)
    }
  }

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - OFFERINGS_PAGE_SIZE),
    nextOffset: offset + OFFERINGS_PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    period,
    status,
    editRow,
    creating,
    resources: resourceOptions,
    error,
    configResourceId: configResourceId ? parseInt(configResourceId, 10) : undefined,
    offeringConfig: offeringConfig ?? undefined,
    addWeek,
    formValues,
    fieldErrors,
    formError,
  }
}

function renderOfferingsPage(context: AppContext, data: OfferingPageData, init?: ResponseInit): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminOfferingsPage
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      period={data.period}
      status={data.status}
      editRow={data.editRow}
      creating={data.creating}
      resources={data.resources}
      error={data.error}
      configResourceId={data.configResourceId}
      offeringConfig={data.offeringConfig}
      addWeek={data.addWeek}
      formValues={data.formValues}
      fieldErrors={data.fieldErrors}
      formError={data.formError}
    />,
    init,
  )
}

export const verwaltungOfferings = createController<typeof routes.verwaltung.offerings, AppContext>(
  routes.verwaltung.offerings,
  {
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

        let result = s.parseSafe(offeringSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let { resource_id, day, start_min, end_min } = result.value

        if (end_min <= start_min) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            formError: 'muss nach der Startzeit liegen.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        if (hd.isHoliday(new Date(day + 'T00:00:00Z'))) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            formError: 'Dieses Datum ist ein Feiertag.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let dayMs = new Date(day + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let data = await loadOfferingPageData(context, {
            creating: true,
            formValues,
            formError: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [dayMs, resource_id, during, now, now],
          )
          newId = insertResult.rows[0].id

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'create',
              target_type: 'appointoffering',
              target_id: newId,
              details: { resource_id, day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let data = await loadOfferingPageData(context, {
              creating: true,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderOfferingsPage(context, data, { status: 400 })
          }
          throw error
        }

        let params = gridStateToParams(gridValues)
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let formData = context.formData
        let id = context.params.id
        if (!id) {
          return context.json(
            { ok: false, error: 'Ungültige ID.' },
            { status: 400 },
          )
        }

        let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let result = s.parseSafe(offeringSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let { resource_id, day, start_min, end_min } = result.value

        if (end_min <= start_min) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            formError: 'muss nach der Startzeit liegen.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        if (hd.isHoliday(new Date(day + 'T00:00:00Z'))) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            formError: 'Dieses Datum ist ein Feiertag.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let dayMs = new Date(day + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let editRow = await fetchOfferingEditRow(id)
          let data = await loadOfferingPageData(context, {
            editRow,
            formValues,
            formError: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderOfferingsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()

        try {
          let updateResult = await pool.query(
            `UPDATE appointoffering
             SET day = $1, resource_id = $2, during = $3, updated_at = $4
             WHERE id = $5`,
            [dayMs, resource_id, during, now, id],
          )

          if (updateResult.rowCount === 0) {
            return context.json(
              { ok: false, error: 'Eintrag nicht gefunden.' },
              { status: 404 },
            )
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'update',
              target_type: 'appointoffering',
              target_id: id,
              details: { resource_id, day, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let editRow = await fetchOfferingEditRow(id)
            let data = await loadOfferingPageData(context, {
              editRow,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Angebot.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderOfferingsPage(context, data, { status: 400 })
          }
          throw error
        }

        let params = gridStateToParams(gridValues)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async destroy(context) {
        let id = context.params.id
        if (!id) {
          return context.json(
            { ok: false, error: 'Ungültige ID.' },
            { status: 400 },
          )
        }

        let formData = context.formData

        try {
          let result = await pool.query(
            'DELETE FROM appointoffering WHERE id = $1',
            [id],
          )

          if (result.rowCount === 0) {
            return context.json(
              { ok: false, error: 'Eintrag nicht gefunden.' },
              { status: 404 },
            )
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'destroy',
              target_type: 'appointoffering',
              target_id: id,
            })
          }
        } catch (error: unknown) {
          if (isConstraintViolation(error)) {
            let params = gridStateToParams(gridStateFromFormData(formData))
            let qs = params.toString()
            return new Response(null, {
              status: 302,
              headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
            })
          }
          throw error
        }

        let params = gridStateToParams(gridStateFromFormData(formData))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async configSave(context) {
        let formData = context.formData

        let result = s.parseSafe(
          f.object({
            resource_id: f.field(s.string().refine(v => /^\d+$/.test(v), 'Ressource ist erforderlich.')),
          }),
          formData,
        )

        if (!result.success) {
          return context.json(
            { ok: false, error: result.issues[0]?.message ?? 'Ungültige Anfrage.' },
            { status: 400 },
          )
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

        await upsertConfig(pool, resourceId, rules)

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'config_save',
            target_type: 'offering_configs',
            target_id: resourceId,
            details: { rules },
          })
        }

        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() },
        })
      },

      async weekGenerate(context) {
        let formData = context.formData

        let result = s.parseSafe(
          f.object({
            year: f.field(s.string().refine(v => /^\d+$/.test(v), 'Jahr ist erforderlich.')),
            week: f.field(s.string().refine(v => /^\d+$/.test(v), 'Woche ist erforderlich.')),
          }),
          formData,
        )

        if (!result.success) {
          return context.json(
            { ok: false, error: result.issues[0]?.message ?? 'Ungültige Anfrage.' },
            { status: 400 },
          )
        }

        let year = parseInt(result.value.year, 10)
        let week = parseInt(result.value.week, 10)

        let configsResult = await pool.query('SELECT resource_id FROM offering_configs')
        let totalCreated = 0
        let totalSkipped = 0
        let allErrors: string[] = []

        for (let row of configsResult.rows) {
          let result = await generateWeek(pool, row.resource_id, year, week)
          totalCreated += result.created
          totalSkipped += result.skipped
          allErrors.push(...result.errors)
        }

        let params = new URLSearchParams()
        if (allErrors.length > 0) {
          params.set('error', `${totalCreated} erstellt, ${totalSkipped} übersprungen. Fehler: ${allErrors[0]}`)
        } else {
          params.set('error', `${totalCreated} Angebote erstellt${totalSkipped > 0 ? `, ${totalSkipped} übersprungen.` : '.'}`)
        }

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'week_generate',
            target_type: 'appointoffering',
            details: { year, week, totalCreated, totalSkipped },
          })
        }

        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async deletePast(context) {
        let formData = context.formData
        let gridValues = gridStateFromFormData(formData)

        let result = await pool.query(
          'DELETE FROM appointoffering WHERE day < $1',
          [getTodayUtcMidnight()],
        )

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'delete_past',
            target_type: 'appointoffering',
            details: { deletedCount: result.rowCount ?? 0 },
          })
        }

        let params = gridStateToParams(gridValues)
        params.set('error', `${result.rowCount ?? 0} vergangene Angebote gelöscht.`)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : '') },
        })
      },
    },
  },
)

// ═══════════════════════════════════════════════════════════════════
// Appointments
// ═══════════════════════════════════════════════════════════════════

const APPOINTMENTS_PAGE_SIZE = 15

const APPOINTMENTS_RATE_LIMIT_MS = process.env.ADMIN_APPOINTMENT_RATE_LIMIT_MS !== undefined
  ? Number(process.env.ADMIN_APPOINTMENT_RATE_LIMIT_MS)
  : 1000
const appointmentsCreateLimiter = createRateLimiter({ windowMs: APPOINTMENTS_RATE_LIMIT_MS, perUser: true })
const appointmentsUpdateLimiter = createRateLimiter({ windowMs: APPOINTMENTS_RATE_LIMIT_MS, perUser: true })
const appointmentsDeleteLimiter = createRateLimiter({ windowMs: APPOINTMENTS_RATE_LIMIT_MS, perUser: true })

const CACHE_TTL_MS = 60_000
let appointmentsResourcesCache: { data: AppointmentResourceOption[]; expiresAt: number } | null = null
let appointmentsUsersCache: { data: AppointmentUserOption[]; expiresAt: number } | null = null

const APPOINTMENTS_ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'u.email': 'u.email',
  'r.description': 'r.name',
  'a.date': 'a.date',
  'a.during': 'a.during',
  'a.created_at': 'a.created_at',
  'a.updated_at': 'a.updated_at',
}

const APPOINTMENTS_SEARCH_COLUMNS = ['a.title', 'u.email', 'r.description', 'r.name'] as const

export interface AppointmentRow {
  id: string
  title: string
  user_id: string
  user_email: string
  resource_id: string
  resource_name: string | null
  resource_description: string | null
  date: string
  during: string
  start_min: number
  end_min: number
  created_at: string
  updated_at: string
}

export interface AppointmentResourceOption {
  id: string
  name: string
  description: string
}

export interface AppointmentUserOption {
  id: string
  name: string
}

interface AppointmentPageData {
  rows: AppointmentRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period: string | undefined
  status: string | undefined
  resources: AppointmentResourceOption[]
  users: AppointmentUserOption[]
  editRow: AppointmentRow | null
  creating: boolean
  error: string | undefined
  defaultStartMin: number
  defaultEndMin: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

function errorRedirectDestroy(formData: FormData, error: string): Response {
  let params = gridStateToParams(gridStateFromFormData(formData))
  params.set('error', error)
  return new Response(null, {
    status: 302,
    headers: { Location: routes.verwaltung.appointments.index.href() + '?' + params.toString() },
  })
}

async function fetchEditRow(id: string): Promise<AppointmentRow | undefined> {
  let editResult = await pool.query(
    `SELECT a.id, a.title, a.user_id, u.email AS user_email,
            a.resource_id, r.name AS resource_name, r.description AS resource_description,
            a.date, during::text AS during, a.start_min, a.end_min,
            a.created_at, a.updated_at
     FROM appointments a
     INNER JOIN users u ON u.id = a.user_id
     LEFT JOIN resources r ON r.id = a.resource_id
     WHERE a.id = $1`,
    [id],
  )
  return editResult.rows.length > 0 ? (editResult.rows[0] as AppointmentRow) : undefined
}

async function loadAppointmentPageData(
  context: AppContext,
  overrides?: Partial<Pick<AppointmentPageData, 'creating' | 'editRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'period' | 'status'>>,
): Promise<AppointmentPageData> {
  let offset = overrides?.offset ?? Math.max(0, (Number(context.url.searchParams.get('offset')) || 0))
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const } : parseSort(context.url, {
    allowedColumns: Object.keys(APPOINTMENTS_ORDER_BY_COLUMNS),
    defaultColumn: 'a.date',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT a.id, a.title, a.user_id, u.email AS user_email,
           a.resource_id, r.name AS resource_name, r.description AS resource_description,
           a.date, during::text AS during, a.start_min, a.end_min,
           a.created_at, a.updated_at
    FROM appointments a
    INNER JOIN users u ON u.id = a.user_id
    LEFT JOIN resources r ON r.id = a.resource_id
  `

  let params: unknown[] = []
  let paramIndex = 0
  let hasWhere = false

  function addWhere(clause: string) {
    if (hasWhere) {
      query += ` AND ${clause}`
    } else {
      query += ` WHERE ${clause}`
      hasWhere = true
    }
  }

  if (filter && filter.length <= 200) {
    paramIndex++
    let searchPattern = `%${filter}%`
    let conditions = APPOINTMENTS_SEARCH_COLUMNS.map(
      (col) => `${col} ILIKE $${paramIndex}`,
    )
    addWhere(`(${conditions.join(' OR ')})`)
    params.push(searchPattern)
  }

  let periodRange = period ? getPeriodRange(period) : null
  if (periodRange) {
    paramIndex++
    addWhere(`a.date >= $${paramIndex}`)
    params.push(periodRange.startMs)

    paramIndex++
    query += ` AND a.date < $${paramIndex}`
    params.push(periodRange.endMs)
  }

  let todayMidnight = getTodayUtcMidnight()
  if (status === 'pending' || !status) {
    paramIndex++
    addWhere(`a.date >= $${paramIndex}`)
    params.push(todayMidnight)
  } else if (status === 'expired') {
    paramIndex++
    addWhere(`a.date < $${paramIndex}`)
    params.push(todayMidnight)
  }

  paramIndex++
  query += ` ORDER BY ${APPOINTMENTS_ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(APPOINTMENTS_PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let resultPromise = pool.query(query, params)

  let resourcesPromise: Promise<{ rows: AppointmentResourceOption[] }>
  if (appointmentsResourcesCache && Date.now() < appointmentsResourcesCache.expiresAt) {
    resourcesPromise = Promise.resolve({ rows: appointmentsResourcesCache.data })
  } else {
    resourcesPromise = pool.query(
      'SELECT id, name, description FROM resources ORDER BY name ASC',
    ).then((r) => {
      appointmentsResourcesCache = { data: r.rows as AppointmentResourceOption[], expiresAt: Date.now() + CACHE_TTL_MS }
      return r
    })
  }

  let usersPromise: Promise<{ rows: AppointmentUserOption[] }>
  if (appointmentsUsersCache && Date.now() < appointmentsUsersCache.expiresAt) {
    usersPromise = Promise.resolve({ rows: appointmentsUsersCache.data })
  } else {
    usersPromise = pool.query(
      'SELECT id, name FROM users ORDER BY name ASC',
    ).then((r) => {
      appointmentsUsersCache = { data: r.rows as AppointmentUserOption[], expiresAt: Date.now() + CACHE_TTL_MS }
      return r
    })
  }

  let [result, resourcesResult, usersResult] = await Promise.all([
    resultPromise, resourcesPromise, usersPromise,
  ])
  let rows = result.rows as AppointmentRow[]
  let hasMore = rows.length > APPOINTMENTS_PAGE_SIZE
  if (hasMore) rows.pop()

  let resourceOptions = resourcesResult.rows as AppointmentResourceOption[]
  let userOptions = usersResult.rows as AppointmentUserOption[]

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam || null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = await fetchEditRow(editingRowId) ?? null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let defaultStartMin = 480
  let defaultEndMin = 1020
  if (creating && resourceOptions.length > 0) {
    let firstResourceId = parseInt(resourceOptions[0].id, 10)
    let today = new Date()
    let searchStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000
    let searchEnd = searchStart + 14 * 86_400_000
    let offerings = await listOfferingsByDayRange(context.db, searchStart, searchEnd, firstResourceId)
    if (offerings.length > 0) {
      let parsed = parseDuring(offerings[0].during)
      if (parsed) {
        defaultStartMin = parsed.startMin
        defaultEndMin = parsed.endMin
      }
    }
  }

  let error = overrides?.error ?? (context.url.searchParams.get('error') || undefined)
  let formValues = overrides?.formValues ?? undefined
  let fieldErrors = overrides?.fieldErrors ?? undefined
  let formError = overrides?.formError ?? undefined

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - APPOINTMENTS_PAGE_SIZE),
    nextOffset: offset + APPOINTMENTS_PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    period,
    status,
    resources: resourceOptions,
    users: userOptions,
    editRow,
    creating,
    error,
    defaultStartMin,
    defaultEndMin,
    formValues,
    fieldErrors,
    formError,
  }
}

function renderAppointmentsPage(
  context: AppContext,
  data: AppointmentPageData,
  init?: ResponseInit,
): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminAppointmentsPage
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      period={data.period}
      status={data.status}
      editRow={data.editRow}
      creating={data.creating}
      resources={data.resources}
      users={data.users}
      error={data.error}
      defaultStartMin={data.defaultStartMin}
      defaultEndMin={data.defaultEndMin}
      formValues={data.formValues}
      fieldErrors={data.fieldErrors}
      formError={data.formError}
    />,
    init,
  )
}

export const verwaltungAppointments = createController<typeof routes.verwaltung.appointments, AppContext>(
  routes.verwaltung.appointments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadAppointmentPageData(context)
        return renderAppointmentsPage(context, data)
      },

      async create(context) {
        let formData = context.formData
        let formValues = readFormFieldValues(APPOINTMENT_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (process.env.NODE_ENV !== 'test' && !appointmentsCreateLimiter.attempt(authUserId)) {
            let data = await loadAppointmentPageData(context, {
              creating: true,
              formValues,
              formError: 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
        }

        let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
        if (!resourceIdRaw.trim()) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            fieldErrors: { resource_id: 'ist erforderlich.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }
        let userIdRaw = (formData.get('user_id') as string) ?? ''
        if (!userIdRaw.trim()) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            fieldErrors: { user_id: 'ist erforderlich.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let result = s.parseSafe(appointmentSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let { resource_id, user_id, title, date, start_min, end_min } = result.value

        if (end_min <= start_min) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            formError: 'muss nach der Startzeit liegen.',
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let bookable = await isSlotBookable(context.db, dayMs, resource_id, start_min, end_min)
        if (!bookable) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            formError: 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [user_id, resource_id, trimmedTitle, dayMs, during, now, now],
          )
          newId = insertResult.rows[0].id

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'create',
              target_type: 'appointment',
              target_id: newId,
              details: { resource_id, user_id, title: date, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let data = await loadAppointmentPageData(context, {
              creating: true,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams(gridValues)
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let formData = context.formData
        let formValues = readFormFieldValues(APPOINTMENT_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let auth = context.auth
        let updateId = context.params.id
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (process.env.NODE_ENV !== 'test' && !appointmentsUpdateLimiter.attempt(authUserId)) {
            let data = await loadAppointmentPageData(context, {
              editRow: updateId ? await fetchEditRow(updateId) : undefined,
              formValues,
              formError: 'Bitte warten Sie, bevor Sie einen Termin bearbeiten.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
        }

        let id = context.params.id

        if (!id) {
          let data = await loadAppointmentPageData(context, {
            formValues,
            formError: 'Ungültige ID.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
        if (!resourceIdRaw.trim()) {
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            fieldErrors: { resource_id: 'ist erforderlich.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }
        let userIdRaw = (formData.get('user_id') as string) ?? ''
        if (!userIdRaw.trim()) {
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            fieldErrors: { user_id: 'ist erforderlich.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let result = s.parseSafe(appointmentSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let { resource_id, user_id, title, date, start_min, end_min } = result.value

        if (end_min <= start_min) {
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            formError: 'muss nach der Startzeit liegen.',
            fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let bookable = await isSlotBookable(context.db, dayMs, resource_id, start_min, end_min)
        if (!bookable) {
          let editRow = await fetchEditRow(id)
          let data = await loadAppointmentPageData(context, {
            editRow,
            formValues,
            formError: 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()

        try {
          let updateResult = await pool.query(
            `UPDATE appointments
             SET user_id = $1, resource_id = $2, title = $3, date = $4, during = $5, updated_at = $6
             WHERE id = $7`,
            [user_id, resource_id, trimmedTitle, dayMs, during, now, id],
          )

          if (updateResult.rowCount === 0) {
            let editRow = await fetchEditRow(id)
            let data = await loadAppointmentPageData(context, {
              editRow,
              formValues,
              formError: 'Eintrag nicht gefunden.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'update',
              target_type: 'appointment',
              target_id: id,
              details: { resource_id, user_id, title: date, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let editRow = await fetchEditRow(id)
            let data = await loadAppointmentPageData(context, {
              editRow,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams(gridValues)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async destroy(context) {
        let id = context.params.id
        let formData = context.formData

        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (process.env.NODE_ENV !== 'test' && !appointmentsDeleteLimiter.attempt(authUserId)) {
            return errorRedirectDestroy(formData, 'Bitte warten Sie, bevor Sie einen Termin löschen.')
          }
        }

        if (!id) {
          return errorRedirectDestroy(formData, 'Ungültige ID.')
        }

        try {
          let result = await pool.query(
            'DELETE FROM appointments WHERE id = $1',
            [id],
          )

          if (result.rowCount === 0) {
            return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(pool, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'destroy',
              target_type: 'appointment',
              target_id: id,
            })
          }
        } catch (error: unknown) {
          if (error && typeof error === 'object') {
            let err = error as { code?: string }
            if (err.code === '23503') {
              return errorRedirectDestroy(formData, 'Dieser Termin kann nicht gelöscht werden, da noch Verweise darauf bestehen.')
            }
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams(gridStateFromFormData(formData))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)

// ═══════════════════════════════════════════════════════════════════
// Resources
// ═══════════════════════════════════════════════════════════════════

type ResourceRow = Resource

const RESOURCES_PAGE_SIZE = 15

const RESOURCE_FORM_KEYS = ['name', 'description'] as const

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
  overrides?: Partial<Pick<ResourcePageData, 'creating' | 'editRow' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<ResourcePageData> {
  let db = context.db
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let pageNum = Math.floor(offset / RESOURCES_PAGE_SIZE) + 1
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: RESOURCES_SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let filterPredicate = filter && filter.length <= 200
    ? ilike('name', `%${filter}%`)
    : undefined

  let { items: page, hasMore } = await paginate(db, resources, {
    pageSize: RESOURCES_PAGE_SIZE,
    page: pageNum,
    orderBy: [[column, direction]],
    where: filterPredicate as Record<string, unknown>,
  })

  let rows = page as ResourceRow[]

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
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
    prevOffset: Math.max(0, offset - RESOURCES_PAGE_SIZE),
    nextOffset: offset + RESOURCES_PAGE_SIZE,
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
  description: f.field(s.defaulted(s.string(), '').refine((v) => v.length >= 8, 'Beschreibung muss mindestens 8 Zeichen lang sein')),
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

export const verwaltungResources = createController<typeof routes.verwaltung.resources, AppContext>(routes.verwaltung.resources, {
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
        { name: parsed.name.trim(), description: parsed.description.trim() },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'resources',
          target_id: row.id as number,
          details: { name: parsed.name.trim(), description: parsed.description.trim() },
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

      await db.updateMany(resources, { name: parsed.name.trim(), description: parsed.description.trim() }, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'resources',
          target_id: id,
          details: { name: parsed.name.trim(), description: parsed.description.trim() },
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
          if (process.env.NODE_ENV !== 'test') context.get(Logger)?.('Constraint violation during resource deletion: ' + JSON.stringify({ code: (error as { code?: string }).code, resourceId: id }))
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

// ═══════════════════════════════════════════════════════════════════
// Offering Configs
// ═══════════════════════════════════════════════════════════════════

export interface OfferingConfigRow {
  id: number
  resource_id: number
  resource_name: string | null
  resource_description: string | null
  rules: Record<string, [number, number]>
  created_at: number
  updated_at: number
}

export interface OfferingConfigResourceOption {
  id: number
  name: string
  description: string
}

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
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: OFFERING_CONFIGS_SORTABLE_FIELDS,
        defaultColumn: 'id',
        defaultDirection: 'asc',
      })

  let whereClause = ''
  let sqlParams: unknown[] = []
  if (filter && filter.length <= 200) {
    whereClause = 'WHERE r.name ILIKE $1'
    sqlParams.push(`%${filter}%`)
  }

  let orderCol = OFFERING_CONFIGS_ORDER_BY_COLUMNS[column] || 'oc.id'
  let orderDir = direction === 'desc' ? 'DESC' : 'ASC'

  let countResult = await pool.query(
    `SELECT COUNT(*) FROM offering_configs oc
     JOIN resources r ON r.id = oc.resource_id
     ${whereClause}`,
    sqlParams,
  )
  let totalRows = Number(countResult.rows[0]?.count ?? 0)
  let hasMore = offset + OFFERING_CONFIGS_PAGE_SIZE < totalRows

  let dataParams = [...sqlParams, OFFERING_CONFIGS_PAGE_SIZE + 1, offset]
  let dataResult = await pool.query(
    `SELECT oc.id, oc.resource_id, r.name AS resource_name, r.description AS resource_description, oc.rules, oc.created_at, oc.updated_at
     FROM offering_configs oc
     JOIN resources r ON r.id = oc.resource_id
     ${whereClause}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $${sqlParams.length + 1} OFFSET $${sqlParams.length + 2}`,
    dataParams,
  )

  let rows: OfferingConfigRow[] = dataResult.rows.map(toOfferingConfigRow)

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam ? Number(editingParam) : null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId && Number.isFinite(editingRowId)) {
    let editResult = await pool.query(
      `SELECT oc.id, oc.resource_id, r.name AS resource_name, r.description AS resource_description, oc.rules, oc.created_at, oc.updated_at
       FROM offering_configs oc
       JOIN resources r ON r.id = oc.resource_id
       WHERE oc.id = $1`,
      [editingRowId],
    )
    if (editResult.rows.length > 0) {
      editRow = toOfferingConfigRow(editResult.rows[0] as Record<string, unknown>)
    }
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let resourcesResult = await pool.query(
    'SELECT id, name, description FROM resources ORDER BY name ASC',
  )
  let resourceOptions: OfferingConfigResourceOption[] = resourcesResult.rows.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    name: r.name as string,
    description: r.description as string,
  }))

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - OFFERING_CONFIGS_PAGE_SIZE),
    nextOffset: offset + OFFERING_CONFIGS_PAGE_SIZE,
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

function toOfferingConfigRow(row: Record<string, unknown>): OfferingConfigRow {
  return {
    id: Number(row.id),
    resource_id: Number(row.resource_id),
    resource_name: (row.resource_name as string) ?? null,
    resource_description: (row.resource_description as string) ?? null,
    rules: typeof row.rules === 'string' ? JSON.parse(row.rules as string) : (row.rules as Record<string, [number, number]>),
    created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
    updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : (row.updated_at as number),
  }
}

export const verwaltungOfferingConfigs = createController<typeof routes.verwaltung.offeringConfigs, AppContext>(routes.verwaltung.offeringConfigs, {
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
        logAdminAction(pool, {
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
        logAdminAction(pool, {
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
        logAdminAction(pool, {
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
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },
  },
})

// ═══════════════════════════════════════════════════════════════════
// Report 1 — Monthly appointment summary per user
// ═══════════════════════════════════════════════════════════════════

const REPORT1_PAGE_SIZE = 20

const REPORT1_ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'u.name',
  count: 'appointment_count',
  min_date: 'min_date',
  max_date: 'max_date',
  total_hours: 'appointment_count',
  avg_hours: 'appointment_count',
}

interface Report1UserOption {
  id: string
  name: string
}

export interface Report1Row {
  user_id: string
  user_name: string
  user_email: string
  appointment_count: string
  min_date: string | null
  max_date: string | null
  total_min: string | null
  avg_min: string | null
}

interface Report1PageData {
  rows: Report1Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  year: number
  month: number
  selectedUserId: number | undefined
  users: Report1UserOption[]
}

async function loadReport1PageData(
  context: AppContext,
  overrides?: Partial<Pick<Report1PageData, 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'year' | 'month' | 'selectedUserId'>>,
): Promise<Report1PageData> {
  let now = new Date()
  let year = overrides?.year ?? (Number(context.url.searchParams.get('year')) || now.getUTCFullYear())
  year = Math.max(2000, Math.min(2100, year))
  let month = overrides?.month ?? (Number(context.url.searchParams.get('month')) || (now.getUTCMonth() + 1))
  month = Math.max(1, Math.min(12, month))
  let selectedUserId = overrides?.selectedUserId
  if (selectedUserId === undefined) {
    let raw = context.url.searchParams.get('user_id')
    selectedUserId = raw ? Number(raw) || undefined : undefined
  }

  let monthStart = Date.UTC(year, month - 1, 1)
  let monthEnd = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1)

  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: Object.keys(REPORT1_ORDER_BY_COLUMNS),
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

  let sortExpr = REPORT1_ORDER_BY_COLUMNS[column] || 'u.name'
  if (column === 'count') sortExpr = `COUNT(*)::int`
  if (column === 'min_date') sortExpr = `MIN(a.date)`
  if (column === 'max_date') sortExpr = `MAX(a.date)`
  if (column === 'total_hours') sortExpr = `SUM(a.end_min - a.start_min)`
  if (column === 'avg_hours') sortExpr = `SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0)`

  let query = `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
                      COUNT(*)::int AS appointment_count,
                      MIN(a.date) AS min_date,
                      MAX(a.date) AS max_date,
                      SUM(a.end_min - a.start_min) AS total_min,
                      ROUND(SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0), 1) AS avg_min
               FROM appointments a
               INNER JOIN users u ON u.id = a.user_id`

  let params: unknown[] = []
  let paramIndex = 0
  let conditions: string[] = []

  paramIndex++
  conditions.push(`a.date >= $${paramIndex}`)
  params.push(monthStart)

  paramIndex++
  conditions.push(`a.date < $${paramIndex}`)
  params.push(monthEnd)

  if (selectedUserId !== undefined) {
    paramIndex++
    conditions.push(`a.user_id = $${paramIndex}`)
    params.push(selectedUserId)
  }

  if (filter && filter.length <= 200) {
    paramIndex++
    conditions.push(`u.name ILIKE $${paramIndex}`)
    params.push(`%${filter}%`)
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  query += ` GROUP BY u.id, u.name, u.email`

  paramIndex++
  query += ` ORDER BY ${sortExpr} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(REPORT1_PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let [result, usersResult] = await Promise.all([
    pool.query(query, params),
    pool.query('SELECT id, name FROM users ORDER BY name ASC'),
  ])

  let rows = result.rows as Report1Row[]
  let hasMore = rows.length > REPORT1_PAGE_SIZE
  if (hasMore) rows.pop()

  let userOptions = usersResult.rows as Report1UserOption[]

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - REPORT1_PAGE_SIZE),
    nextOffset: offset + REPORT1_PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    year,
    month,
    selectedUserId,
    users: userOptions,
  }
}

function renderReport1Page(context: AppContext, data: Report1PageData, init?: ResponseInit): Response {
  return renderVerwaltungPage(
    context.render,
    <AdminReport1Page
      rows={data.rows}
      offset={data.offset}
      hasMore={data.hasMore}
      prevOffset={data.prevOffset}
      nextOffset={data.nextOffset}
      sortColumn={data.sortColumn}
      sortDirection={data.sortDirection}
      filter={data.filter}
      year={data.year}
      month={data.month}
      selectedUserId={data.selectedUserId}
      users={data.users}
    />,
    init,
  )
}

export const verwaltungReport1 = createController<typeof routes.verwaltung.report1, AppContext>(
  routes.verwaltung.report1,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadReport1PageData(context)
        return renderReport1Page(context, data)
      },
    },
  },
)
