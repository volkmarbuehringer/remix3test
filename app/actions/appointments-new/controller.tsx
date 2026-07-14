import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { getCurrentWeekMonday, getTodayUtcMidnight, isWithinHours } from '../../utils/date-utils.ts'
import {
  listOfferingsByDayRange,
  parseDuring,
  computeFullHourSlots,
  getBookedRangesForWeek,
  filterAvailableSlots,
} from '../../data/appointofferings.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { getSafeReturnTo } from '../../utils/redirect.ts'
import { Layout } from '../../ui/layout.tsx'
import { AppointmentsNewPage } from '../../ui/appointments-new-page.tsx'
import { parseSort } from '../../utils/sort-params.ts'
import {
  gridStateToParams,
  gridStateFromFormData,
  gridStateOffset,
  gridStateSort,
  gridStateDirection,
  gridStateFilter,
  gridStatePeriod,
  gridStateStatus,
} from '../../utils/grid-state.ts'
import { appointmentChannel } from '../../utils/appointments-sse.ts'
import {
  appointmentsNewSaveSchema,
  APPOINTMENTS_NEW_FORM_KEYS,
} from '../../utils/appointment-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { isExclusionConstraintError, isConstraintViolation } from '../../utils/db-errors.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { getPageSize } from '../../utils/get-page-size.ts'
import type { AppointmentsNewRow, ResourceOption, DayWithSlots } from '../../data/appointments.ts'
import {
  listResources,
  listAppointmentsNew,
  APPOINTMENTS_NEW_PAGE_SIZE,
  APPOINTMENTS_NEW_ORDER_BY_COLUMNS,
  checkResourceExists,
  getAppointmentForDelete,
  createAppointmentRecord,
  getAppointmentRow,
  deleteAppointmentRecord,
} from '../../data/appointments.ts'

function redirectToLogin(context: AppContext): Response {
  let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? context.url.pathname
  let location = returnTo
    ? `${routes.auth.login.index.href()}?returnTo=${encodeURIComponent(returnTo)}`
    : routes.auth.login.index.href()
  return redirect(location)
}

const CACHE_TTL_MS = 60_000
let resourcesCache: { data: ResourceOption[]; expiresAt: number } | null = null

const RATE_LIMIT_MS =
  Number(process.env.APPOINTMENT_RATE_LIMIT_MS) ||
  (process.env.NODE_ENV === 'production' ? 1000 : 0)
const createLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const deleteLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })

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
  overrides?: Partial<
    Pick<
      AppointmentsNewPageData,
      | 'creating'
      | 'deletingRow'
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
      | 'step'
      | 'wizardResourceId'
      | 'weekStart'
    >
  >,
): Promise<AppointmentsNewPageData> {
  let effectivePageSize = getPageSize(context.session, APPOINTMENTS_NEW_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: Object.keys(APPOINTMENTS_NEW_ORDER_BY_COLUMNS),
        defaultColumn: 'a.date',
        defaultDirection: 'asc',
      })

  let { rows, hasMore } = await listAppointmentsNew(context.db, {
    userId,
    offset,
    pageSize: effectivePageSize,
    column,
    direction,
    period,
    status,
  })

  let deletingParam =
    overrides?.deletingRow !== undefined ? null : context.url.searchParams.get('deleting')

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let step =
    overrides?.step ?? (creating ? Number(context.url.searchParams.get('step')) || 1 : undefined)

  let needsResources = !creating || !step || step === 1

  let resources: ResourceOption[] = []

  if (needsResources) {
    if (resourcesCache && Date.now() < resourcesCache.expiresAt) {
      resources = resourcesCache.data
    } else {
      let data = await listResources(context.db)
      resourcesCache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
      resources = data
    }
  }

  let isAdmin = !!(context.auth?.ok && (context.auth.identity as { role: string }).role === 'admin')
  for (let r of rows) {
    let apptStartMs = Number(r.date) + r.start_min * 60000
    let isWithinGracePeriod = r.created_at
      ? Date.now() - Number(r.created_at) < 10 * 60 * 1000
      : false
    r.blocked = !isAdmin && !isWithinHours(apptStartMs, 24) && !isWithinGracePeriod
  }
  let wizardResourceId =
    overrides?.wizardResourceId ?? (context.url.searchParams.get('resource_id') || undefined)
  let weekStartRaw =
    overrides?.weekStart !== undefined
      ? String(overrides.weekStart)
      : context.url.searchParams.get('week_start') || undefined
  let weekStart = weekStartRaw
    ? parseInt(weekStartRaw, 10)
    : creating && step === 2
      ? getCurrentWeekMonday()
      : undefined

  let daysWithSlots: DayWithSlots[] | undefined
  let defaultStartMin = 480

  if (creating && step === 2 && wizardResourceId) {
    let searchStart = weekStart!
    let searchEnd = searchStart + 7 * 86_400_000
    let resourceIdNum = parseInt(wizardResourceId, 10)
    let resourceExists = await checkResourceExists(context.db, resourceIdNum)
    if (resourceExists) {
      let offerings = await listOfferingsByDayRange(
        context.db,
        searchStart,
        searchEnd,
        resourceIdNum,
      )
      let bookedByDay = await getBookedRangesForWeek(
        context.db,
        resourceIdNum,
        searchStart,
        searchEnd,
      )

      let dayMap = new Map<
        number,
        { ranges: { startMin: number; endMin: number }[]; slots: number[] }
      >()
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
        .filter((dws) => dws.day >= todayMs)
        .map((dws) => {
          if (dws.day === todayMs) {
            let now = new Date()
            let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes()
            dws.slots = dws.slots.filter((min) => currentMin < min)
          }
          return dws
        })
        .filter((dws) => dws.slots.length > 0)

      if (daysWithSlots.length > 0 && daysWithSlots[0].slots.length > 0) {
        defaultStartMin = daysWithSlots[0].slots[0]
      }
    }
  }

  // Load row for delete confirmation
  let deletingRow: AppointmentsNewRow | null =
    overrides?.deletingRow !== undefined ? overrides.deletingRow : null
  if (!deletingRow && deletingParam) {
    deletingRow = (await getAppointmentForDelete(context.db, deletingParam, userId)) ?? null
    if (deletingRow) {
      let apptStartMs = Number(deletingRow.date) + deletingRow.start_min * 60000
      let isWithinGracePeriod = deletingRow.created_at
        ? Date.now() - Number(deletingRow.created_at) < 10 * 60 * 1000
        : false
      deletingRow.blocked = !isAdmin && !isWithinHours(apptStartMs, 24) && !isWithinGracePeriod
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

export default createController<typeof routes.appointmentsNew, AppContext>(routes.appointmentsNew, {
  middleware: [requireAuth()],

  actions: {
    async index(context) {
      let auth = context.auth as { identity: { id: number; role: string } }
      let userId = auth.identity.id
      let data = await loadAppointmentsNewPageData(context, userId)
      return renderAppointmentsNewPage(context, data)
    },

    async create(context) {
      let auth = context.auth as { identity: { id: number; role: string } }
      let userId = auth.identity.id
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
            creating: true,
            step: 2,
            wizardResourceId: resourceIdRaw || undefined,
            weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
            formValues,
            fieldErrors: { day_start: 'Ungültiges Format.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }
        let dayMs = parseInt(parts[0], 10)
        let startMin = parseInt(parts[1], 10)
        if (!Number.isFinite(dayMs) || !Number.isFinite(startMin)) {
          let data = await loadAppointmentsNewPageData(context, userId, {
            creating: true,
            step: 2,
            wizardResourceId: resourceIdRaw || undefined,
            weekStart: weekStartRaw ? parseInt(weekStartRaw, 10) : undefined,
            formValues,
            fieldErrors: { day_start: 'Ungültiges Format.' },
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
            status: gridStateStatus(gridValues),
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
          newId = await createAppointmentRecord(context.db, {
            userId,
            resourceId: resource_id,
            title,
            dayMs,
            during,
            now,
          })
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

        let params = gridStateToParams({
          ...gridValues,
          period: '',
          filter: '',
          offset: '',
          status: '',
        })
        let qs = params.toString()
        return redirect(routes.appointmentsNew.index.href() + (qs ? '?' + qs : ''))
      }

      // No valid step — redirect to step 1 (resource cards)
      return redirect(routes.appointmentsNew.index.href() + '?creating=true')
    },

    async destroy(context) {
      let auth = context.auth as { identity: { id: number; role: string } }
      let userId = auth.identity.id
      let id = context.params.id
      let formData = context.formData

      if (!deleteLimiter.attempt(userId)) {
        return errorRedirectDestroy(formData, 'Bitte warten Sie, bevor Sie einen Termin löschen.')
      }

      if (!id) {
        return errorRedirectDestroy(formData, 'Ungültige ID.')
      }

      let row = await getAppointmentRow(context.db, id, userId)
      if (!row) {
        return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
      }
      let appointmentStartMs = Number(row.date) + row.start_min * 60000
      let isWithinGracePeriod = Date.now() - Number(row.created_at) < 10 * 60 * 1000
      if (
        !isWithinHours(appointmentStartMs, 24) &&
        !isWithinGracePeriod &&
        (auth.identity as { role: string }).role !== 'admin'
      ) {
        return errorRedirectDestroy(
          formData,
          'Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden.',
        )
      }

      try {
        let deleted = await deleteAppointmentRecord(context.db, id, userId)
        if (!deleted) {
          return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
        }
      } catch (error: unknown) {
        if (isConstraintViolation(error)) {
          return errorRedirectDestroy(
            formData,
            'Dieser Termin kann nicht gelöscht werden, da noch Verweise darauf bestehen.',
          )
        }
        throw error
      }

      appointmentChannel.broadcast('invalidate')

      let params = gridStateToParams({
        ...gridStateFromFormData(formData),
        period: '',
        filter: '',
        offset: '',
        status: '',
      })
      let qs = params.toString()
      return redirect(routes.appointmentsNew.index.href() + (qs ? '?' + qs : ''))
    },

    async events(context) {
      return appointmentChannel.subscribe(context.request)
    },
  },
})
