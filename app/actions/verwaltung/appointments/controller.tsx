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
import { isSlotBookable, listOfferingsByDayRange, parseDuring } from '../../../data/appointofferings.ts'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import Holidays from 'date-holidays'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { appointmentChannel } from '../../../lib/appointments-sse.ts'
import { appointmentSaveSchema, APPOINTMENT_FORM_KEYS } from '../../../utils/appointment-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { paginate } from '../../../utils/pagination.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { gridStateFromForm, gridStateFromFormData, gridStateToParams, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter, gridStatePeriod, gridStateStatus } from '../../../utils/grid-state.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { AdminAppointmentsPage } from '../../../ui/admin-appointments-page.tsx'

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

const APPOINTMENTS_SORTABLE_FIELDS = [
  'a.id', 'a.title', 'u.email', 'r.description', 'a.date', 'a.during', 'a.created_at', 'a.updated_at',
] as const

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

const hd = new Holidays('DE', 'rp')

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
  return redirect(routes.verwaltung.appointments.index.href() + '?' + params.toString())
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
  let effectivePageSize = getPageSize(context.session, APPOINTMENTS_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, (Number(context.url.searchParams.get('offset')) || 0))
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const } : parseSort(context.url, {
    allowedColumns: APPOINTMENTS_SORTABLE_FIELDS,
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
  params.push(effectivePageSize + 1)

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
  let hasMore = rows.length > effectivePageSize
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
    prevOffset: Math.max(0, offset - effectivePageSize),
    nextOffset: offset + effectivePageSize,
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

        let params = gridStateToParams({ ...gridValues, period: '', filter: '', offset: '', status: '' })
        params.set('editing', String(newId))
        let qs = params.toString()
        return redirect(routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : ''))
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

        let params = gridStateToParams({ ...gridValues, period: '', filter: '', offset: '', status: '' })
        let qs = params.toString()
        return redirect(routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : ''))
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

        let params = gridStateToParams({ ...gridStateFromFormData(formData), period: '', filter: '', offset: '', status: '' })
        let qs = params.toString()
        return redirect(routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : ''))
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)
