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
import { pool } from '../../../data/setup.ts'
import { isDateInPast, getPeriodRange, getTodayUtcMidnight } from '../../../utils/date-utils.ts'
import Holidays from 'date-holidays'
import { offeringSaveSchema, OFFERING_FORM_KEYS } from '../../../utils/offering-schema.ts'
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
  gridStatePeriod,
  gridStateStatus,
} from '../../../utils/grid-state.ts'
import { getAdminIdentity } from '../../../utils/context.ts'

import { AdminOfferingsPage } from '../../../ui/admin-offerings-page.tsx'
import { getConfig, upsertConfig, generateWeek } from '../../../data/offering-configs.ts'
import type { OfferingConfig } from '../../../data/offering-configs.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'

const hd = new Holidays('DE', 'rp')

// ═══════════════════════════════════════════════════════════════════
// Offerings
// ═══════════════════════════════════════════════════════════════════

const OFFERINGS_PAGE_SIZE = 12

const OFFERINGS_SORTABLE_FIELDS = [
  'ao.id', 'ao.day', 'ao.resource_id', 'r.description', 'ao.during', 'ao.created_at', 'ao.updated_at',
] as const

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
  let effectivePageSize = getPageSize(context.session, OFFERINGS_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const }
    : parseSort(context.url, {
        allowedColumns: OFFERINGS_SORTABLE_FIELDS,
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
  queryParams.push(effectivePageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  queryParams.push(offset)

  let result = await pool.query(query, queryParams)
  let rows = result.rows as OfferingRow[]
  let hasMore = rows.length > effectivePageSize
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
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
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

export default createController<typeof routes.verwaltung.offerings, AppContext>(
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
        return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
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
        return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
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
            return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
          }
          throw error
        }

        let params = gridStateToParams(gridStateFromFormData(formData))
        let qs = params.toString()
        return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
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

        return redirect(routes.verwaltung.offerings.index.href())
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
        return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
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
        return redirect(routes.verwaltung.offerings.index.href() + (qs ? '?' + qs : ''))
      },
    },
  },
)
