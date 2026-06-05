import { createController } from 'remix/router'
import * as s from 'remix/data-schema'

import { routes } from '../../routes.ts'
import { pool } from '../../data/setup.ts'
import type { AppContext } from '../../types/context.ts'
import { isDateInPast, getPeriodRange } from '../../utils/date-utils.ts'
import { listOfferingsByDayRange, listOfferingsByDay, parseDuring, listDaysWithOfferings, computeFullHourSlots } from '../../data/appointofferings.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { getSafeReturnTo } from '../../utils/redirect.ts'
import { Layout } from '../../ui/layout.tsx'
import { AppointmentsNewPage } from '../../ui/appointments-new-page.tsx'
import { parseSort } from '../../utils/sort-params.ts'
import { gridStateToParams, gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter, gridStatePeriod } from '../../utils/grid-state.ts'
import { appointmentChannel } from '../../lib/appointments-sse.ts'
import { appointmentsNewSaveSchema, APPOINTMENTS_NEW_FORM_KEYS } from '../../utils/appointment-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'

function redirectToLogin(context: AppContext): Response {
  let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? context.url.pathname
  let location = returnTo
    ? `${routes.auth.login.index.href()}?returnTo=${encodeURIComponent(returnTo)}`
    : routes.auth.login.index.href()
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  })
}

const PAGE_SIZE = 15

const CACHE_TTL_MS = 60_000
let resourcesCache: { data: ResourceOption[]; expiresAt: number } | null = null

const RATE_LIMIT_MS = Number(process.env.APPOINTMENT_RATE_LIMIT_MS) || (process.env.NODE_ENV === 'production' ? 1000 : 0)
const createLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const updateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })
const deleteLimiter = createRateLimiter({ windowMs: RATE_LIMIT_MS, perUser: true })

const ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'r.description': 'r.description',
  'a.date': 'a.date',
  'a.during': 'a.during',
}

export interface AppointmentsNewRow {
  id: string
  title: string
  resource_id: string
  resource_description: string | null
  date: string
  during: string
  start_min: number
  end_min: number
}

export interface ResourceOption {
  id: string
  description: string
}

function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string; constraint?: string }
    return (
      err.constraint === 'no_overlapping_seats' ||
      err.code === '23P01' ||
      (err.message ?? '').includes('conflicts with key')
    )
  }
  return false
}

function errorRedirectDestroy(formData: FormData, error: string): Response {
  let params = gridStateToParams(gridStateFromFormData(formData))
  params.set('error', error)
  return new Response(null, {
    status: 302,
    headers: { Location: routes.appointmentsNew.index.href() + '?' + params.toString() },
  })
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
  resources: ResourceOption[]
  editRow: AppointmentsNewRow | null
  creating: boolean
  error: string | undefined
  defaultStartMin: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  step?: number
  wizardResourceId?: string
  wizardDay?: number
  daysWithOfferings?: { day: number; ranges: { startMin: number; endMin: number }[] }[]
  fullHourSlots?: number[]
}

async function loadAppointmentsNewPageData(
  context: AppContext,
  userId: number,
  overrides?: Partial<Pick<AppointmentsNewPageData, 'creating' | 'editRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter' | 'period' | 'step' | 'wizardResourceId' | 'wizardDay'>>,
): Promise<AppointmentsNewPageData> {
  let offset = overrides?.offset ?? Math.max(0, (Number(context.url.searchParams.get('offset')) || 0))
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)
  let period = (overrides?.period ?? context.url.searchParams.get('period')) || undefined

  let { column, direction } = overrides?.sortColumn ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const } : parseSort(context.url, {
    allowedColumns: Object.keys(ORDER_BY_COLUMNS),
    defaultColumn: 'a.date',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT a.id, a.title,
           a.resource_id, r.description AS resource_description,
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

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')

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
        'SELECT id, description FROM resources ORDER BY description ASC',
      )
      resourcesCache = { data: resourcesResult.rows as ResourceOption[], expiresAt: Date.now() + CACHE_TTL_MS }
    }
    resources = resourcesResult.rows as ResourceOption[]
  }

  let result = await pool.query(query, params)
  let rows = result.rows as AppointmentsNewRow[]
  let hasMore = rows.length > PAGE_SIZE
  if (hasMore) rows.pop()
  let wizardResourceId = overrides?.wizardResourceId ?? (context.url.searchParams.get('resource_id') || undefined)
  let wizardDayStr = overrides?.wizardDay !== undefined ? String(overrides.wizardDay) : (context.url.searchParams.get('day') || undefined)

  let daysWithOfferings: { day: number; ranges: { startMin: number; endMin: number }[] }[] | undefined
  let fullHourSlots: number[] | undefined
  let defaultStartMin = 480

  if (creating && step) {
    if (step === 2 && wizardResourceId) {
      let periodRange = period ? getPeriodRange(period) : null
      let searchStart: number
      let searchEnd: number
      if (periodRange) {
        searchStart = periodRange.startMs
        searchEnd = periodRange.endMs
      } else {
        let today = new Date()
        searchStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
        searchEnd = searchStart + 90 * 86_400_000
      }
      daysWithOfferings = await listDaysWithOfferings(context.db, parseInt(wizardResourceId, 10), searchStart, searchEnd)
    }
    if (step === 3 && wizardResourceId && wizardDayStr) {
      let dayOfferings = await listOfferingsByDay(context.db, parseInt(wizardDayStr, 10), parseInt(wizardResourceId, 10))
      let ranges = dayOfferings.map(o => parseDuring(o.during)).filter((r): r is { startMin: number; endMin: number } => r !== null)
      fullHourSlots = computeFullHourSlots(ranges)
      if (fullHourSlots.length > 0) {
        defaultStartMin = fullHourSlots[0]
      }
    }
  }

  // Compute full-hour slots for edit mode
  let editRowLocal = overrides?.editRow !== undefined ? overrides.editRow : null
  if (!editRowLocal && editingParam) {
    let editResult = await pool.query(
      `SELECT a.id, a.title,
              a.resource_id, r.description AS resource_description,
              a.date, during::text AS during, a.start_min, a.end_min
       FROM appointments a
       LEFT JOIN resources r ON r.id = a.resource_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [editingParam, userId],
    )
    editRowLocal = editResult.rows.length > 0 ? (editResult.rows[0] as AppointmentsNewRow) : null
  }

  if (editRowLocal) {
    let editResourceId = parseInt(editRowLocal.resource_id, 10)
    let editDate = Number(editRowLocal.date)
    let editOfferings = await listOfferingsByDayRange(context.db, editDate, editDate + 86_400_000, editResourceId)
    let editRanges = editOfferings.map(o => parseDuring(o.during)).filter((r): r is { startMin: number; endMin: number } => r !== null)
    let allSlots = computeFullHourSlots(editRanges)
    let currentMin = Number(editRowLocal.start_min)
    if (!allSlots.includes(currentMin)) {
      allSlots.push(currentMin)
      allSlots.sort((a, b) => a - b)
    }
    fullHourSlots = allSlots
  }

  let editRow = editRowLocal

  if (!creating || !step || step === 1) {
    if (creating && resources.length > 0) {
      let firstResourceId = parseInt(resources[0].id, 10)
      let today = new Date()
      let searchStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000
      let searchEnd = searchStart + 14 * 86_400_000
      let offerings = await listOfferingsByDayRange(context.db, searchStart, searchEnd, firstResourceId)
      if (offerings.length > 0) {
        let parsed = parseDuring(offerings[0].during)
        if (parsed) {
          defaultStartMin = parsed.startMin
        }
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
    prevOffset: Math.max(0, offset - PAGE_SIZE),
    nextOffset: offset + PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    period,
    resources,
    editRow,
    creating,
    error,
    defaultStartMin,
    formValues,
    fieldErrors,
    formError,
    step,
    wizardResourceId,
    wizardDay: wizardDayStr ? parseInt(wizardDayStr, 10) : undefined,
    daysWithOfferings,
    fullHourSlots,
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
        editRow={data.editRow}
        creating={data.creating}
        resources={data.resources}
        error={data.error}
        defaultStartMin={data.defaultStartMin}
        formValues={data.formValues}
        fieldErrors={data.fieldErrors}
        formError={data.formError}
        step={data.step}
        wizardResourceId={data.wizardResourceId}
        wizardDay={data.wizardDay}
        daysWithOfferings={data.daysWithOfferings}
        fullHourSlots={data.fullHourSlots}
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

        // Wizard step 1: validate resource selection, advance to step 2
        if (step === '1') {
          let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
          if (!resourceIdRaw.trim()) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 1,
              formValues,
              fieldErrors: { resource_id: 'Bitte wählen Sie eine Ressource aus.' },
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          let params = new URLSearchParams()
          params.set('creating', 'true')
          params.set('step', '2')
          params.set('resource_id', resourceIdRaw.trim())
          if (gridValues.period) params.set('period', gridValues.period)
          return new Response(null, {
            status: 302,
            headers: { Location: routes.appointmentsNew.index.href() + '?' + params.toString() },
          })
        }

        // Wizard step 2: validate day selection, advance to step 3
        if (step === '2') {
          let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
          let dayRaw = (formData.get('day') as string) ?? ''
          if (!dayRaw.trim() || !resourceIdRaw.trim()) {
            let fieldErrors: Record<string, string> = {}
            if (!resourceIdRaw.trim()) fieldErrors.resource_id = 'Ressource fehlt.'
            if (!dayRaw.trim()) fieldErrors.day = 'Bitte wählen Sie einen Tag aus.'
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 2,
              wizardResourceId: resourceIdRaw.trim() || undefined,
              formValues,
              fieldErrors,
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          let params = new URLSearchParams()
          params.set('creating', 'true')
          params.set('step', '3')
          params.set('resource_id', resourceIdRaw.trim())
          params.set('day', dayRaw.trim())
          if (gridValues.period) params.set('period', gridValues.period)
          return new Response(null, {
            status: 302,
            headers: { Location: routes.appointmentsNew.index.href() + '?' + params.toString() },
          })
        }

        // Final step (step 3 or no step): create the appointment
        let createWizardResourceId = (formData.get('resource_id') as string) || undefined
        let createDateRaw = (formData.get('date') as string) || undefined
        let createWizardDay = createDateRaw ? new Date(createDateRaw + 'T00:00:00Z').getTime() : undefined

        if (!createLimiter.attempt(userId)) {
          let data = await loadAppointmentsNewPageData(context, userId, {
            creating: true,
            step: 3,
            wizardResourceId: createWizardResourceId,
            wizardDay: createWizardDay,
            formValues,
            formError: 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let result = s.parseSafe(appointmentsNewSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let data = await loadAppointmentsNewPageData(context, userId, {
            creating: true,
            step: 3,
            wizardResourceId: createWizardResourceId,
            wizardDay: createWizardDay,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let { resource_id, title, date, start_min } = result.value
        let end_min = start_min + 60

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let data = await loadAppointmentsNewPageData(context, userId, {
            creating: true,
            step: 3,
            wizardResourceId: createWizardResourceId,
            wizardDay: createWizardDay,
            formValues,
            formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [userId, resource_id, trimmedTitle, dayMs, during, now, now],
          )
          newId = insertResult.rows[0].id
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let data = await loadAppointmentsNewPageData(context, userId, {
              creating: true,
              step: 3,
              wizardResourceId: createWizardResourceId,
              wizardDay: createWizardDay,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams(gridValues)
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.appointmentsNew.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let auth = context.auth
        if (!auth?.ok) return redirectToLogin(context)
        let userId = (auth.identity as { id: number }).id
        let formData = context.formData
        let formValues = readFormFieldValues(APPOINTMENTS_NEW_FORM_KEYS, formData)
        let gridValues = gridStateFromFormData(formData)

        if (!updateLimiter.attempt(userId)) {
          let data = await loadAppointmentsNewPageData(context, userId, {
            editRow: context.params.id ? await fetchEditRow(context.params.id, userId) : undefined,
            formValues,
            formError: 'Bitte warten Sie, bevor Sie einen Termin bearbeiten.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let id = context.params.id

        if (!id) {
          let data = await loadAppointmentsNewPageData(context, userId, {
            formValues,
            formError: 'Ungültige ID.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let result = s.parseSafe(appointmentsNewSaveSchema, formData)

        if (!result.success) {
          let fieldErrors = issuesToFieldErrors(result.issues)
          let editRow = await fetchEditRow(id, userId)
          let data = await loadAppointmentsNewPageData(context, userId, {
            editRow,
            formValues,
            fieldErrors,
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let { resource_id, title, date, start_min } = result.value
        let end_min = start_min + 60

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        if (isDateInPast(dayMs)) {
          let editRow = await fetchEditRow(id, userId)
          let data = await loadAppointmentsNewPageData(context, userId, {
            editRow,
            formValues,
            formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
            period: gridStatePeriod(gridValues),
          })
          return renderAppointmentsNewPage(context, data, { status: 400 })
        }

        let during = `[${start_min},${end_min})`
        let now = Date.now()

        try {
          let updateResult = await pool.query(
            `UPDATE appointments
             SET resource_id = $1, title = $2, date = $3, during = $4, updated_at = $5
             WHERE id = $6 AND user_id = $7`,
            [resource_id, trimmedTitle, dayMs, during, now, id, userId],
          )

          if (updateResult.rowCount === 0) {
            let editRow = await fetchEditRow(id, userId)
            let data = await loadAppointmentsNewPageData(context, userId, {
              editRow,
              formValues,
              formError: 'Eintrag nicht gefunden.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            let editRow = await fetchEditRow(id, userId)
            let data = await loadAppointmentsNewPageData(context, userId, {
              editRow,
              formValues,
              formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
              period: gridStatePeriod(gridValues),
            })
            return renderAppointmentsNewPage(context, data, { status: 400 })
          }
          throw error
        }

        appointmentChannel.broadcast('invalidate')

        let params = gridStateToParams(gridValues)
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: routes.appointmentsNew.index.href() + (qs ? '?' + qs : '') },
        })
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

        try {
          let result = await pool.query(
            'DELETE FROM appointments WHERE id = $1 AND user_id = $2',
            [id, userId],
          )

          if (result.rowCount === 0) {
            return errorRedirectDestroy(formData, 'Eintrag nicht gefunden.')
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
          headers: { Location: routes.appointmentsNew.index.href() + (qs ? '?' + qs : '') },
        })
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)

async function fetchEditRow(id: string, userId: number): Promise<AppointmentsNewRow | undefined> {
  let editResult = await pool.query(
    `SELECT a.id, a.title,
            a.resource_id, r.description AS resource_description,
            a.date, during::text AS during, a.start_min, a.end_min
     FROM appointments a
     LEFT JOIN resources r ON r.id = a.resource_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId],
  )
  return editResult.rows.length > 0 ? (editResult.rows[0] as AppointmentsNewRow) : undefined
}
