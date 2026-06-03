import { createController } from 'remix/router'
import * as s from 'remix/data-schema'

import { verwaltungRoutes as routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { isDateInPast } from '../utils/date-utils.ts'
import { isSlotBookable, listOfferingsByDayRange, parseDuring } from '../data/appointofferings.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderVerwaltungPage } from '../ui/verwaltung-layout.tsx'
import { AdminAppointmentsPage } from '../ui/admin-appointments-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { gridStateToParams, gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter } from '../utils/grid-state.ts'
import { createRateLimiter } from '../utils/rate-limiter.ts'
import { appointmentChannel } from '../lib/appointments-sse.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { appointmentSaveSchema, APPOINTMENT_FORM_KEYS } from '../utils/appointment-schema.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'

const PAGE_SIZE = 15

// Rate limiters for mutation endpoints (1 req/s in production, disabled otherwise)
const ADMIN_RATE_LIMIT_MS = Number(process.env.ADMIN_APPOINTMENT_RATE_LIMIT_MS) || (process.env.NODE_ENV === 'production' ? 1000 : 0)
const adminCreateLimiter = createRateLimiter({ windowMs: ADMIN_RATE_LIMIT_MS, perUser: true })
const adminUpdateLimiter = createRateLimiter({ windowMs: ADMIN_RATE_LIMIT_MS, perUser: true })
const adminDeleteLimiter = createRateLimiter({ windowMs: ADMIN_RATE_LIMIT_MS, perUser: true })

// Simple in-memory cache for slowly-changing reference data (resources, users)
const CACHE_TTL_MS = 60_000 // 60 seconds
let resourcesCache: { data: ResourceOption[]; expiresAt: number } | null = null
let usersCache: { data: UserOption[]; expiresAt: number } | null = null

const ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'u.email': 'u.email',
  'r.description': 'r.description',
  'a.date': 'a.date',
  'a.during': 'a.during',
  'a.created_at': 'a.created_at',
  'a.updated_at': 'a.updated_at',
}

const SEARCH_COLUMNS = ['a.title', 'u.email', 'r.description'] as const

export interface AppointmentRow {
  id: string
  title: string
  user_id: string
  user_email: string
  resource_id: string
  resource_description: string | null
  date: string
  during: string
  start_min: number
  end_min: number
  created_at: string
  updated_at: string
}

export interface ResourceOption {
  id: string
  description: string
}

export interface UserOption {
  id: string
  name: string
}

// ── Form schema ──────────────────────────────────────────────────
// (appointmentSaveSchema imported from ../utils/appointment-schema.ts)

// ── Validation helpers ───────────────────────────────────────────

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

// ── Shared error helpers ─────────────────────────────────────────

/**
 * Build an error redirect from FormData (for the destroy action).
 * Extracts grid state from hidden _offset/_sort/_order/_filter fields.
 */
function errorRedirectDestroy(
  formData: FormData,
  error: string,
): Response {
  let params = gridStateToParams(gridStateFromFormData(formData))
  params.set('error', error)
  return new Response(null, {
    status: 302,
    headers: { Location: routes.verwaltung.appointments.index.href() + '?' + params.toString() },
  })
}

// ── Shared page data ─────────────────────────────────────────────

interface AppointmentPageData {
  rows: AppointmentRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  resources: ResourceOption[]
  users: UserOption[]
  editRow: AppointmentRow | null
  creating: boolean
  error: string | undefined
  defaultStartMin: number
  defaultEndMin: number
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadAppointmentPageData(
  context: AppContext,
  overrides?: Partial<Pick<AppointmentPageData, 'creating' | 'editRow' | 'error' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<AppointmentPageData> {
  let offset = overrides?.offset ?? Math.max(0, (Number(context.url.searchParams.get('offset')) || 0))
  let filter = overrides?.filter ?? (context.url.searchParams.get('filter') || undefined)

  let { column, direction } = overrides?.sortColumn ? { column: overrides.sortColumn, direction: overrides.sortDirection ?? 'asc' as const } : parseSort(context.url, {
    allowedColumns: Object.keys(ORDER_BY_COLUMNS),
    defaultColumn: 'a.date',
    defaultDirection: 'asc',
  })

  let query = `
    SELECT a.id, a.title, a.user_id, u.email AS user_email,
           a.resource_id, r.description AS resource_description,
           a.date, during::text AS during, a.start_min, a.end_min,
           a.created_at, a.updated_at
    FROM appointments a
    INNER JOIN users u ON u.id = a.user_id
    LEFT JOIN resources r ON r.id = a.resource_id
  `

  let params: unknown[] = []
  let paramIndex = 0

  if (filter && filter.length <= 200) {
    paramIndex++
    let searchPattern = `%${filter}%`
    let conditions = SEARCH_COLUMNS.map(
      (col) => `${col} ILIKE $${paramIndex}`,
    )
    query += ` WHERE (${conditions.join(' OR ')})`
    params.push(searchPattern)
  }

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  // Run independent queries in parallel for ~2x faster page loads
  let resultPromise = pool.query(query, params)

  // Cache resources query (slowly-changing reference data)
  let resourcesPromise: Promise<{ rows: ResourceOption[] }>
  if (resourcesCache && Date.now() < resourcesCache.expiresAt) {
    resourcesPromise = Promise.resolve({ rows: resourcesCache.data })
  } else {
    resourcesPromise = pool.query(
      'SELECT id, description FROM resources ORDER BY description ASC',
    ).then((r) => {
      resourcesCache = { data: r.rows as ResourceOption[], expiresAt: Date.now() + CACHE_TTL_MS }
      return r
    })
  }

  // Cache users query (slowly-changing reference data)
  let usersPromise: Promise<{ rows: UserOption[] }>
  if (usersCache && Date.now() < usersCache.expiresAt) {
    usersPromise = Promise.resolve({ rows: usersCache.data })
  } else {
    usersPromise = pool.query(
      'SELECT id, name FROM users ORDER BY name ASC',
    ).then((r) => {
      usersCache = { data: r.rows as UserOption[], expiresAt: Date.now() + CACHE_TTL_MS }
      return r
    })
  }

  let [result, resourcesResult, usersResult] = await Promise.all([
    resultPromise, resourcesPromise, usersPromise,
  ])
  let rows = result.rows as AppointmentRow[]
  let hasMore = rows.length > PAGE_SIZE
  if (hasMore) rows.pop()

  let resources = resourcesResult.rows as ResourceOption[]
  let users = usersResult.rows as UserOption[]

  // Check for inline editing state
  let editingParam = overrides?.editRow !== undefined ? null : context.url.searchParams.get('editing')
  let editingRowId = editingParam || null
  let editRow = overrides?.editRow ?? null
  if (!editRow && editingRowId) {
    editRow = await fetchEditRow(editingRowId) ?? null
  }

  let creating = overrides?.creating ?? context.url.searchParams.get('creating') === 'true'

  // Dynamic default time selection: detect offering hours for the first resource
  let defaultStartMin = 480 // 08:00 fallback
  let defaultEndMin = 1020 // 17:00 fallback
  if (creating && resources.length > 0) {
    let firstResourceId = parseInt(resources[0].id, 10)
    // Scan up to 14 days ahead for the first available offering (single query)
    let today = new Date()
    let searchStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000 // tomorrow
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
    prevOffset: Math.max(0, offset - PAGE_SIZE),
    nextOffset: offset + PAGE_SIZE,
    sortColumn: column,
    sortDirection: direction,
    filter,
    resources,
    users,
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

async function fetchEditRow(id: string): Promise<AppointmentRow | undefined> {
  let editResult = await pool.query(
    `SELECT a.id, a.title, a.user_id, u.email AS user_email,
            a.resource_id, r.description AS resource_description,
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

// ── Controller ───────────────────────────────────────────────────

export default createController<typeof routes.verwaltung.appointments, AppContext>(
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

        // Rate limiting
        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminCreateLimiter.attempt(authUserId)) {
            let data = await loadAppointmentPageData(context, {
              creating: true,
              formValues,
              formError: 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
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
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let { resource_id, user_id, title, date, start_min, end_min } = result.value

        // Cross-field validation
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
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        // Reject past-date creation
        if (isDateInPast(dayMs)) {
          let data = await loadAppointmentPageData(context, {
            creating: true,
            formValues,
            formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.',
            offset: gridStateOffset(gridValues),
            sortColumn: gridStateSort(gridValues),
            sortDirection: gridStateDirection(gridValues),
            filter: gridStateFilter(gridValues),
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        // Validate that the requested slot is within an offering
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

          let auth = context.auth
          let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
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
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
          throw error
        }

        // Broadcast invalidation so other sessions reload
        appointmentChannel.broadcast('invalidate')

        // Redirect back with preserved grid state, showing the new record in edit mode
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

        // Rate limiting
        let auth = context.auth
        let updateId = context.params.id
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminUpdateLimiter.attempt(authUserId)) {
            let data = await loadAppointmentPageData(context, {
              editRow: updateId ? await fetchEditRow(updateId) : undefined,
              formValues,
              formError: 'Bitte warten Sie, bevor Sie einen Termin bearbeiten.',
              offset: gridStateOffset(gridValues),
              sortColumn: gridStateSort(gridValues),
              sortDirection: gridStateDirection(gridValues),
              filter: gridStateFilter(gridValues),
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
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let { resource_id, user_id, title, date, start_min, end_min } = result.value

        // Cross-field validation
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
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        let trimmedTitle = title.trim()
        let dayMs = new Date(date + 'T00:00:00Z').getTime()

        // Reject past-date update
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
          })
          return renderAppointmentsPage(context, data, { status: 400 })
        }

        // Validate that the requested slot is within an offering
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
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }

          let auth = context.auth
          let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
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
            })
            return renderAppointmentsPage(context, data, { status: 400 })
          }
          throw error
        }

        // Broadcast invalidation so other sessions reload
        appointmentChannel.broadcast('invalidate')

        // Redirect back with preserved grid state
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

        // Rate limiting
        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminDeleteLimiter.attempt(authUserId)) {
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

          let auth = context.auth
          let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
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
            // Foreign key violation (23503)
            if (err.code === '23503') {
              return errorRedirectDestroy(formData, 'Dieser Termin kann nicht gelöscht werden, da noch Verweise darauf bestehen.')
            }
          }
          throw error
        }

        // Broadcast invalidation so other sessions reload
        appointmentChannel.broadcast('invalidate')

        // Redirect back with preserved grid state
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
