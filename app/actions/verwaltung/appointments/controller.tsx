import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { isConstraintViolation, isExclusionConstraintError } from '../../../utils/db-errors.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { renderVerwaltungPage } from '../../../ui/verwaltung-layout.tsx'
import { routes } from '../../../routes.ts'
import { isDateInPast, getPeriodRange, getTodayUtcMidnight } from '../../../utils/date-utils.ts'
import {
  isSlotBookable,
  listOfferingsByDayRange,
  parseDuring,
} from '../../../data/appointofferings.ts'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import Holidays from 'date-holidays'
import { createRateLimiter } from '../../../utils/rate-limiter.ts'
import { appointmentChannel } from '../../../utils/appointments-sse.ts'
import { appointmentSaveSchema, APPOINTMENT_FORM_KEYS } from '../../../utils/appointment-schema.ts'
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
import { getPageSize } from '../../../utils/get-page-size.ts'
import { AdminAppointmentsPage } from '../../../ui/admin-appointments-page.tsx'

import {
  listAppointments,
  fetchAppointmentEditRow,
  listResourcesForAppointments,
  listUsersForAppointments,
  adminCreateAppointment,
  adminUpdateAppointment,
  adminDeleteAppointment,
} from '../../../data/appointments.ts'
import type {
  AppointmentRow,
  AppointmentResourceOption,
  AppointmentUserOption,
} from '../../../data/appointments.ts'

// ═══════════════════════════════════════════════════════════════════
// Appointments
// ═══════════════════════════════════════════════════════════════════

const APPOINTMENTS_PAGE_SIZE = 15

const APPOINTMENTS_RATE_LIMIT_MS =
  process.env.ADMIN_APPOINTMENT_RATE_LIMIT_MS !== undefined
    ? Number(process.env.ADMIN_APPOINTMENT_RATE_LIMIT_MS)
    : 1000
const appointmentsCreateLimiter = createRateLimiter({
  windowMs: APPOINTMENTS_RATE_LIMIT_MS,
  perUser: true,
})
const appointmentsUpdateLimiter = createRateLimiter({
  windowMs: APPOINTMENTS_RATE_LIMIT_MS,
  perUser: true,
})
const appointmentsDeleteLimiter = createRateLimiter({
  windowMs: APPOINTMENTS_RATE_LIMIT_MS,
  perUser: true,
})

const CACHE_TTL_MS = 60_000
let appointmentsResourcesCache: { data: AppointmentResourceOption[]; expiresAt: number } | null =
  null
let appointmentsUsersCache: { data: AppointmentUserOption[]; expiresAt: number } | null = null

const APPOINTMENTS_SORTABLE_FIELDS = [
  'a.id',
  'a.title',
  'u.email',
  'r.description',
  'a.date',
  'a.during',
  'a.created_at',
  'a.updated_at',
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

const hd = new Holidays('DE', 'rp')

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

async function loadAppointmentPageData(
  context: any,
  overrides?: Partial<
    Pick<
      AppointmentPageData,
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
  >,
): Promise<AppointmentPageData> {
  let effectivePageSize = getPageSize(context.session, APPOINTMENTS_PAGE_SIZE)
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined
  let status = overrides?.status ?? (context.url.searchParams.get('status') || undefined)

  let { column, direction } = overrides?.sortColumn
    ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? ('asc' as const) }
    : parseSort(context.url, {
        allowedColumns: APPOINTMENTS_SORTABLE_FIELDS,
        defaultColumn: 'a.date',
        defaultDirection: 'asc',
      })

  let [{ rows, hasMore }, resourcesResult, usersResult] = await Promise.all([
    listAppointments(context.db, {
      offset,
      pageSize: effectivePageSize,
      column,
      direction,
      filter,
      period,
      status,
    }),
    (() => {
      if (appointmentsResourcesCache && Date.now() < appointmentsResourcesCache.expiresAt) {
        return Promise.resolve(appointmentsResourcesCache.data)
      }
      return listResourcesForAppointments(context.db).then((data) => {
        appointmentsResourcesCache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
        return data
      })
    })(),
    (() => {
      if (appointmentsUsersCache && Date.now() < appointmentsUsersCache.expiresAt) {
        return Promise.resolve(appointmentsUsersCache.data)
      }
      return listUsersForAppointments(context.db).then((data) => {
        appointmentsUsersCache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
        return data
      })
    })(),
  ])

  let editingParam =
    overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam || null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = (await fetchAppointmentEditRow(context.db, editingRowId)) ?? null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  let defaultStartMin = 480
  let defaultEndMin = 1020
  if (creating && resourcesResult.length > 0) {
    let firstResourceId = parseInt(resourcesResult[0].id, 10)
    let today = new Date()
    let searchStart =
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000
    let searchEnd = searchStart + 14 * 86_400_000
    let offerings = await listOfferingsByDayRange(
      context.db,
      searchStart,
      searchEnd,
      firstResourceId,
    )
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
    resources: resourcesResult,
    users: usersResult,
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
  context: any,
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

export default createController(
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
        let newId: number

        try {
          newId = await adminCreateAppointment(context.db, {
            title: trimmedTitle,
            userId: user_id,
            resourceId: resource_id,
            date: dayMs,
            during,
          })

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(context.db, {
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

        let params = gridStateToParams({
          ...gridValues,
          period: '',
          filter: '',
          offset: '',
          status: '',
        })
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
              editRow: updateId ? await fetchAppointmentEditRow(context.db, updateId) : undefined,
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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
          let editRow = await fetchAppointmentEditRow(context.db, id)
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

        try {
          let updated = await adminUpdateAppointment(context.db, id, {
            title: trimmedTitle,
            userId: user_id,
            resourceId: resource_id,
            date: dayMs,
            during,
          })

          if (!updated) {
            let editRow = await fetchAppointmentEditRow(context.db, id)
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
            logAdminAction(context.db, {
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
            let editRow = await fetchAppointmentEditRow(context.db, id)
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

        let params = gridStateToParams({
          ...gridValues,
          period: '',
          filter: '',
          offset: '',
          status: '',
        })
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
            return errorRedirectDestroy(
              formData,
              'Bitte warten Sie, bevor Sie einen Termin löschen.',
            )
          }
        }

        if (!id) {
          return errorRedirectDestroy(formData, 'Ungültige ID.')
        }

        try {
          let deleted = await adminDeleteAppointment(context.db, id)

          if (!deleted) {
            return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
          }

          let authIdentity = getAdminIdentity(context.auth)
          if (authIdentity) {
            logAdminAction(context.db, {
              admin_user_id: authIdentity.id,
              admin_email: authIdentity.email,
              action_type: 'destroy',
              target_type: 'appointment',
              target_id: id,
            })
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
        return redirect(routes.verwaltung.appointments.index.href() + (qs ? '?' + qs : ''))
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)
