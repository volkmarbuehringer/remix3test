import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { pool } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { getPeriodRange, getCurrentWeekMonday, getTodayUtcMidnight, isWithinHours } from '../../utils/date-utils.ts'
import { listOfferingsByDayRange, parseDuring, computeFullHourSlots, getBookedRangesForWeek, filterAvailableSlots } from '../../data/appointofferings.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { getSafeReturnTo } from '../../utils/redirect.ts'
import { Layout } from '../../ui/layout.tsx'
import { AppointmentsNewPage } from '../../ui/appointments-new-page.tsx'
import { parseSort } from '../../utils/sort-params.ts'
import { gridStateToParams, gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter, gridStatePeriod, gridStateStatus } from '../../utils/grid-state.ts'
import { appointmentChannel } from '../../lib/appointments-sse.ts'
import { appointmentsNewSaveSchema, APPOINTMENTS_NEW_FORM_KEYS } from '../../utils/appointment-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { isExclusionConstraintError, isConstraintViolation } from '../../utils/db-errors.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { getPageSize } from '../../utils/get-page-size.ts'

function redirectToLogin(context: AppContext): Response {
  let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? context.url.pathname
  let location = returnTo
    ? `${routes.auth.login.index.href()}?returnTo=${encodeURIComponent(returnTo)}`
    : routes.auth.login.index.href()
  return redirect(location)
}

const PAGE_SIZE = 15

const CACHE_TTL_MS = 60_000
let resourcesCache: { data: ResourceOption[]; expiresAt: number } | null = null

const RATE_LIMIT_MS = Number(process.env.APPOINTMENT_RATE_LIMIT_MS) || (process.env.NODE_ENV === 'production' ? 1000 : 0)
const createLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const deleteLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })

const ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'r.description': 'r.name',
  'a.date': 'a.date',
  'a.during': 'a.during',
}

export interface AppointmentsNewRow {
  id: string
  title: string
  resource_id: string
  resource_name: string | null
  resource_description: string | null
  date: string
  during: string
  start_min: number
  end_min: number
  blocked?: boolean
}

export interface ResourceOption {
  id: string
  name: string
  description: string
}

export interface DayWithSlots {
  day: number
  dateStr: string
  slots: number[]
  ranges: { startMin: number; endMin: number }[]
}

function errorRedirectDestroy(formData: FormData, error: string): Response {
  let params = gridStateToParams(gridStateFromFormData(formData))
  params.set('error', error)
  return redirect(routes.appointmentsNew.index.href() + '?' + params.toString())
}

interface AppointmentsNewPageData {
  rows: AppointmentsNewRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  period: string | undefined
  status: string | undefined
  resources: ResourceOption[]
  deletingRow: AppointmentsNewRow | null
  creating: boolean
  error: string | undefined
  defaultStartMin: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  weekStart?: number
  daysWithSlots?: DayWithSlots[]
}

async function loadAppointmentsNewPageData(
  context: AppContext,
  userId: number,
  overrides?: Partial<Pick<AppointmentsNewPageData, 'creating' | 'deletingRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'period' | 'status' | 'step' | 'wizardResourceId' | 'weekStart'>>,
): Promise<AppointmentsNewPageData> {
  let effectivePageSize = getPageSize(context.session, PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, (Number(context.url.searchParams.get('offset')) || 0))
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const } : parseSort(context.url, {
    allowedColumns: Object.keys(ORDER_BY_COLUMNS),
    defaultColumn: 'a.date',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT a.id, a.title,
           a.resource_id, r.name AS resource_name, r.description AS resource_description,
           a.date, during::text AS during, a.start_min, a.end_min
    FROM appointments a
    LEFT JOIN resources r ON r.id = a.resource_id
    WHERE a.user_id = $1
  `
  let params: unknown[] = [userId]
  let paramIndex = 1

  let periodRange = period ? getPeriodRange(period) : null
  if (periodRange) {
    paramIndex++
    query += ` AND a.date >= $${paramIndex}`
    params.push(periodRange.startMs)
    paramIndex++
    query += ` AND a.date < $${paramIndex}`
    params.push(periodRange.endMs)
  }

  let todayMidnight = getTodayUtcMidnight()
  if (status === 'pending' || !status) {
    paramIndex++
    query += ` AND a.date >= $${paramIndex}`
    params.push(todayMidnight)
  } else if (status === 'expired') {
    paramIndex++
    query += ` AND a.date < $${paramIndex}`
    params.push(todayMidnight)
  }

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}, a.start_min ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(effectivePageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let deletingParam = overrides?.deletingRow !== undefined ? null : context.url.searchParams.get('deleting')

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let step = overrides?.step ?? (creating ? (Number(context.url.searchParams.get('step')) || 1) : undefined)

  let needsResources = !creating || !step || step === 1

  let resources: ResourceOption[] = []
  let resourcesResult: { rows: ResourceOption[] } | null = null

  if (needsResources) {
    if (resourcesCache && Date.now() < resourcesCache.expiresAt) {
      resourcesResult = { rows: resourcesCache.data }
    } else {
      resourcesResult = await pool.query(
        'SELECT id, name, description FROM resources ORDER BY name ASC',
      )
      resourcesCache = { data: resourcesResult.rows as ResourceOption[], expiresAt: Date.now() + CACHE_TTL_MS }
    }
    resources = resourcesResult.rows as ResourceOption[]
  }

  let result = await pool.query(query, params)
  let rows = result.rows as AppointmentsNewRow[]
  let hasMore = rows.length > effectivePageSize
  if (hasMore) rows.pop()
  for (let r of rows) {
    let apptStartMs = Number(r.date) + r.start_min * 60000
    r.blocked = !isWithinHours(apptStartMs, 24)
  }
  let wizardResourceId = overrides?.wizardResourceId ?? (context.url.searchParams.get('resource_id') || undefined)
  let weekStartRaw = overrides?.weekStart !== undefined ? String(overrides.weekStart) : (context.url.searchParams.get('week_start') || undefined)
  let weekStart = weekStartRaw ? parseInt(weekStartRaw, 10) : (creating && step === 2 ? getCurrentWeekMonday() : undefined)

  let daysWithSlots: DayWithSlots[] | undefined
  let defaultStartMin = 480

  if (creating && step === 2 && wizardResourceId) {
    let searchStart = weekStart!
    let searchEnd = searchStart + 7 * 86_400_000
    let resourceIdNum = parseInt(wizardResourceId, 10)
    // Verify resource exists to avoid confusing empty state
    let resourceCheck = await pool.query('SELECT 1 FROM resources WHERE id = $1', [resourceIdNum])
    if (resourceCheck.rows.length > 0) {

    let offerings = await listOfferingsByDayRange(context.db, searchStart, searchEnd, resourceIdNum)
    let bookedByDay = await getBookedRangesForWeek(context.db, resourceIdNum, searchStart, searchEnd)

    let dayMap = new Map<number, { ranges: { startMin: number; endMin: number }[]; slots: number[] }>()
    for (let offering of offerings) {
      let d = Number(offering.day)
      if (!dayMap.has(d)) dayMap.set(d, { ranges: [], slots: [] })
      let parsed = parseDuring(offering.during)
      if (parsed) dayMap.get(d)!.ranges.push(parsed)
    }
    for (let [d, data] of dayMap) {
      data.slots = computeFullHourSlots(data.ranges)
      let booked = bookedByDay.get(d) ?? []
      if (booked.length > 0) {
        data.slots = filterAvailableSlots(data.slots, booked)
      }
    }
    daysWithSlots = Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, data]) => ({
        day,
        dateStr: new Date(day).toISOString().split('T')[0],
        slots: data.slots,
        ranges: data.ranges,
      }))

    // Filter out past days and past time slots for today
    let todayMs = getTodayUtcMidnight()
    daysWithSlots = daysWithSlots
      .filter(dws => dws.day >= todayMs)
      .map(dws => {
        if (dws.day === todayMs) {
          let now = new Date()
          let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes()
          dws.slots = dws.slots.filter(min => currentMin < min)
        }
        return dws
      })
      .filter(dws => dws.slots.length > 0)

    if (daysWithSlots.length > 0 && daysWithSlots[0].slots.length > 0) {
      defaultStartMin = daysWithSlots[0].slots[0]
    }
  }
  }

  // Load row for delete confirmation
  let deletingRow: AppointmentsNewRow | null = overrides?.deletingRow !== undefined ? overrides.deletingRow : null
  if (!deletingRow && deletingParam) {
    let deleteResult = await pool.query(
      `SELECT a.id, a.title,
              a.resource_id, r.name AS resource_name, r.description AS resource_description,
              a.date, during::text AS during, a.start_min, a.end_min
       FROM appointments a
       LEFT JOIN resources r ON r.id = a.resource_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [deletingParam, userId],
    )
    deletingRow = deleteResult.rows.length > 0 ? (deleteResult.rows[0] as AppointmentsNewRow) : null
    if (deletingRow) {
      let apptStartMs = Number(deletingRow.date) + deletingRow.start_min * 60000
      deletingRow.blocked = !isWithinHours(apptStartMs, 24)
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
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
    sortColumn: column,
    sortDirection: direction,
    filter,
    period,
    status,
    resources,
    deletingRow,
    creating,
    error,
    defaultStartMin,
    formValues,
    fieldErrors,
    formError,
    step,
    wizardResourceId,
    weekStart,
    daysWithSlots,
  }
}

function renderAppointmentsNewPage(
  context: AppContext,
  data: AppointmentsNewPageData,
  init?: ResponseInit,
): Response {
  return context.render(
    <Layout>
      <AppointmentsNewPage
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
        deletingRow={data.deletingRow}
        creating={data.creating}
        resources={data.resources}
        error={data.error}
        defaultStartMin={data.defaultStartMin}
        formValues={data.formValues}
        fieldErrors={data.fieldErrors}
        formError={data.formError}
        step={data.step}
        wizardResourceId={data.wizardResourceId}
        weekStart={data.weekStart}
        daysWithSlots={data.daysWithSlots}
      />
    </Layout>,
    init,
  )
}

export default createController<typeof routes.appointmentsNew, AppContext>(
  routes.appointmentsNew,
  {
    middleware: [requireAuth()],

    actions: {
      async index(context) {
        let auth = context.auth
        if (!auth?.ok) return redirectToLogin(context)
        let userId = (auth.identity as { id: number }).id
        let data = await loadAppointmentsNewPageData(context, userId)
        return renderAppointmentsNewPage(context, data)
      },

      async create(context) {
        let auth = context.auth
        if (!auth?.ok) return redirectToLogin(context)
        let userId = (auth.identity as { id: number }).id
        let formData = context.formData
        let formValues = readFormFieldValues(APPOINTMENTS_NEW_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        let step = formData.get('step') as string | null

        // Combined step 2: validate and create appointment in one submission
        if (step === '2') {
          let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
          let dayStartRaw = (formData.get('day_start') as string) ?? ''
          let weekStartRaw = (formData.get('week_start') as string) || undefined

          if (!createLimiter.attempt(userId)) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 2,
              wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues,
              formError: 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }

          // Validate day_start is present (combined "epoch_ms:minutes")
          if (!dayStartRaw.trim()) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 2,
              wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues,
              fieldErrors: { day_start: 'Bitte wählen Sie eine Uhrzeit aus.' },
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }

          // Parse combined "epoch_ms:minutes" value
          let parts = dayStartRaw.split(':')
          if (parts.length !== 2) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true, step: 2, wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues, fieldErrors: { day_start: 'Ungültiges Format.' },
              offset: gridStateOffset(gridValues), sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues), filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues), status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          let dayMs = parseInt(parts[0], 10)
          let startMin = parseInt(parts[1], 10)
          if (!Number.isFinite(dayMs) || !Number.isFinite(startMin)) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true, step: 2, wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues, fieldErrors: { day_start: 'Ungültiges Format.' },
              offset: gridStateOffset(gridValues), sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues), filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues), status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          let dateStr = new Date(dayMs).toISOString().split('T')[0]

          // Create a modified formData with date and start_min for schema validation
          let createFormData = new FormData()
          for (let [key, val] of formData) {
            createFormData.append(key, val)
          }
          createFormData.set('date', dateStr)
          createFormData.set('start_min', String(startMin))

          let result = s.parseSafe(appointmentsNewSaveSchema, createFormData)

          if (!result.success) {
            let fieldErrors = issuesToFieldErrors(result.issues)
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 2,
              wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues,
              fieldErrors,
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }

          let { resource_id, title } = result.value
          let end_min = startMin + 60

          let appointmentStartMs = dayMs + startMin * 60000
          if (appointmentStartMs <= Date.now()) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 2,
              wizardResourceId: resourceIdRaw || undefined,
              weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
              formValues,
              formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
              status: gridStateStatus(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }

          let during = `[${startMin},${end_min})`
          let now = Date.now()
          let newId: number

          try {
            let insertResult = await pool.query(
              `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [userId, resource_id, title, dayMs, during, now, now],
            )
            newId = insertResult.rows[0].id
          } catch (error: unknown) {
            if (isExclusionConstraintError(error)) {
              let data = await loadAppointmentsNewPageData(context, userId, {
                creating: true,
                step: 2,
                wizardResourceId: resourceIdRaw || undefined,
                weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
                formValues,
                formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.',
                offset: gridStateOffset(gridValues),
                sortColumn: gridStateSort(gridValues),
                sortDirection: gridStateDirection(gridValues),
                filter: gridStateFilter(gridValues),
                period: gridStatePeriod(gridValues),
                status: gridStateStatus(gridValues),
              })
              return renderAppointmentsNewPage(context, data, { status: 400 })
            }
            throw error
          }

          appointmentChannel.broadcast('invalidate')

          let params = gridStateToParams({ ...gridValues, period: '', filter: '', offset: '', status: '' })
          let qs = params.toString()
          return redirect(routes.appointmentsNew.index.href() + (qs ? '?' + qs : ''))
        }

        // No valid step — redirect to step 1 (resource cards)
        return redirect(routes.appointmentsNew.index.href() + '?creating=true')
      },



      async destroy(context) {
        let auth = context.auth
        if (!auth?.ok) return redirectToLogin(context)
        let userId = (auth.identity as { id: number }).id
        let id = context.params.id
        let formData = context.formData

        if (!deleteLimiter.attempt(userId)) {
          return errorRedirectDestroy(formData, 'Bitte warten Sie, bevor Sie einen Termin löschen.')
        }

        if (!id) {
          return errorRedirectDestroy(formData, 'Ungültige ID.')
        }

        let rowResult = await pool.query(
          `SELECT date, start_min FROM appointments WHERE id = $1 AND user_id = $2`,
          [id, userId],
        )
        if (rowResult.rows.length === 0) {
          return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
        }
        let row = rowResult.rows[0] as { date: string; start_min: number }
        let appointmentStartMs = Number(row.date) + row.start_min * 60000
        if (!isWithinHours(appointmentStartMs, 24) && (auth.identity as { role: string }).role !== 'admin') {
          return errorRedirectDestroy(formData, 'Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden.')
        }

        try {
          let result = await pool.query(
            'DELETE FROM appointments WHERE id = $1 AND user_id = $2',
            [id, userId],
          )

          if (result.rowCount === 0) {
            return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
          }
        } catch (error: unknown) {
          if (isConstraintViolation(error)) {
            return errorRedirectDestroy(formData, 'Dieser Termin kann nicht gelöscht werden, da noch Verweise darauf bestehen.')
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams({ ...gridStateFromFormData(formData), period: '', filter: '', offset: '', status: '' })
        let qs = params.toString()
        return redirect(routes.appointmentsNew.index.href() + (qs ? '?' + qs : ''))
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)

