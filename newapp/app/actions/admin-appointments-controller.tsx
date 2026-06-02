import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { adminRoutes as routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { isDateInPast } from '../utils/date-utils.ts'
import { isSlotBookable, listOfferingsByDayRange, parseDuring } from '../data/appointofferings.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminAppointmentsPage } from '../ui/admin-appointments-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { gridStateToParams, gridStateFromForm, gridStateFromFormData } from '../utils/grid-state.ts'
import { createRateLimiter } from '../utils/rate-limiter.ts'
import { appointmentChannel } from '../lib/appointments-sse.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { encodeFormValues, decodeFormValues, encodeFieldErrors, decodeFieldErrors } from '../utils/form-params.ts'

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

const appointmentSaveSchema = f.object({
  resource_id: f.field(s.string()),
  user_id: f.field(s.string()),
  title: f.field(s.string()),
  date: f.field(s.string()),
  start_min: f.field(s.string()),
  end_min: f.field(s.string()),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

// ── Validation helpers ───────────────────────────────────────────

interface ValidationResultOk {
  ok: true
}

interface ValidationResultFail {
  ok: false
  fieldErrors: Record<string, string>
}

type ValidationResult = ValidationResultOk | ValidationResultFail

function validateAppointmentForm(parsed: Record<string, string>): ValidationResult {
  let resourceId = parseInt(parsed.resource_id, 10)
  if (!resourceId || isNaN(resourceId)) {
    return { ok: false, fieldErrors: { resource_id: 'ist erforderlich.' } }
  }

  let userId = parseInt(parsed.user_id, 10)
  if (!userId || isNaN(userId)) {
    return { ok: false, fieldErrors: { user_id: 'ist erforderlich.' } }
  }

  if (!parsed.title || parsed.title.trim().length === 0) {
    return { ok: false, fieldErrors: { title: 'ist erforderlich.' } }
  }

  if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return { ok: false, fieldErrors: { date: 'Gültiges Datum erforderlich (YYYY-MM-DD).' } }
  }

  let startMin = parseInt(parsed.start_min, 10)
  if (isNaN(startMin) || startMin < 0 || startMin > 1380 || startMin % 15 !== 0) {
    return { ok: false, fieldErrors: { start_min: 'ist ungültig.' } }
  }

  let endMin = parseInt(parsed.end_min, 10)
  if (isNaN(endMin) || endMin < 60 || endMin > 1440 || endMin % 15 !== 0) {
    return { ok: false, fieldErrors: { end_min: 'ist ungültig.' } }
  }

  if (endMin <= startMin) {
    return { ok: false, fieldErrors: { end_min: 'muss nach der Startzeit liegen.' } }
  }

  return { ok: true }
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

// ── Shared error helpers ─────────────────────────────────────────

function buildErrorRedirectUrl(
  parsed: Record<string, string>,
  extra?: { creating?: boolean; editing?: string; formError?: string; fieldErrors?: Record<string, string> },
): string {
  let state = {
    offset: parsed._offset,
    sort: parsed._sort,
    order: parsed._order,
    filter: parsed._filter,
  }
  let params = gridStateToParams(state)
  if (extra?.creating) params.set('creating', 'true')
  if (extra?.editing) params.set('editing', extra.editing)
  if (extra?.formError) params.set('error', extra.formError)
  let fv = encodeFormValues(APPOINTMENT_FORM_KEYS, parsed)
  for (let [k, v] of Object.entries(fv)) {
    params.set(k, v)
  }
  if (extra?.fieldErrors) {
    let fe = encodeFieldErrors(extra.fieldErrors)
    for (let [k, v] of Object.entries(fe)) {
      params.set(k, v)
    }
  }
  let qs = params.toString()
  return '/admin/appointments' + (qs ? '?' + qs : '')
}

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
    headers: { Location: '/admin/appointments?' + params.toString() },
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
  let formValues = overrides?.formValues ?? decodeFormValues(APPOINTMENT_FORM_KEYS, context.url)
  let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(APPOINTMENT_FORM_KEYS, context.url)
  let formError = overrides?.formError ?? error

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
): Response {
  return renderAdminPage(
    context.render,
    'appointments',
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
  )
}

// Form values serialized as URL params (fv_ prefix) to survive frame redirects.
// Only 6 fields — compact enough for URL encoding.
const APPOINTMENT_FORM_KEYS = ['resource_id', 'user_id', 'title', 'date', 'start_min', 'end_min'] as const

// ── Controller ───────────────────────────────────────────────────

export default createController<typeof routes.admin.appointments, AppContext>(
  routes.admin.appointments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let data = await loadAppointmentPageData(context)
        return renderAppointmentsPage(context, data)
      },

      async create(context) {
        let formData = context.formData

        // Rate limiting
        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminCreateLimiter.attempt(authUserId)) {
            return new Response(null, {
              status: 302,
              headers: { Location: buildErrorRedirectUrl({ _offset: '', _sort: '', _order: '', _filter: '' }, { creating: true, formError: 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.' }) },
            })
          }
        }

        let parsed: Record<string, string>
        try {
          parsed = s.parse(appointmentSaveSchema, formData) as Record<string, string>
        } catch {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl({ _offset: '', _sort: '', _order: '', _filter: '' }, { creating: true, formError: 'Ungültige Formulardaten.' }) },
          })
        }

        let validationResult = validateAppointmentForm(parsed)
        if (!validationResult.ok) {
          let formError = Object.values(validationResult.fieldErrors)[0]
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { creating: true, formError, fieldErrors: validationResult.fieldErrors }) },
          })
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let userId = parseInt(parsed.user_id, 10)
        let title = parsed.title.trim()
        let dayMs = new Date(parsed.date + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date creation
        if (isDateInPast(dayMs)) {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { creating: true, formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.' }) },
          })
        }

        // Validate that the requested slot is within an offering
        let bookable = await isSlotBookable(context.db, dayMs, resourceId, startMin, endMin)
        if (!bookable) {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { creating: true, formError: 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.' }) },
          })
        }

        let during = `[${startMin},${endMin})`
        let now = Date.now()
        let newId: number

        try {
          let insertResult = await pool.query(
            `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [userId, resourceId, title, dayMs, during, now, now],
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
              details: { resource_id: resourceId, user_id: userId, title, date: parsed.date, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            return new Response(null, {
              status: 302,
              headers: { Location: buildErrorRedirectUrl(parsed, { creating: true, formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.' }) },
            })
          }
          throw error
        }

        // Broadcast invalidation so other sessions reload
        appointmentChannel.broadcast('invalidate')

        // Redirect back with preserved grid state, showing the new record in edit mode
        let params = gridStateToParams(gridStateFromForm(parsed))
        params.set('editing', String(newId))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/appointments' + (qs ? '?' + qs : '') },
        })
      },

      async update(context) {
        let formData = context.formData

        // Rate limiting
        let auth = context.auth
        let updateId = context.params.id
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminUpdateLimiter.attempt(authUserId)) {
            return new Response(null, {
              status: 302,
              headers: { Location: buildErrorRedirectUrl({ _offset: '', _sort: '', _order: '', _filter: '' }, { editing: updateId ?? undefined, formError: 'Bitte warten Sie, bevor Sie einen Termin bearbeiten.' }) },
            })
          }
        }

        let parsed: Record<string, string>
        try {
          parsed = s.parse(appointmentSaveSchema, formData) as Record<string, string>
        } catch {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl({ _offset: '', _sort: '', _order: '', _filter: '' }, { editing: updateId ?? undefined, formError: 'Ungültige Formulardaten.' }) },
          })
        }

        let id = context.params.id

        if (!id) {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { formError: 'Ungültige ID.' }) },
          })
        }

        let validationResult = validateAppointmentForm(parsed)
        if (!validationResult.ok) {
          let formError = Object.values(validationResult.fieldErrors)[0]
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { editing: id, formError, fieldErrors: validationResult.fieldErrors }) },
          })
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let userId = parseInt(parsed.user_id, 10)
        let title = parsed.title.trim()
        let dayMs = new Date(parsed.date + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date update
        if (isDateInPast(dayMs)) {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { editing: id, formError: 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.' }) },
          })
        }

        // Validate that the requested slot is within an offering
        let bookable = await isSlotBookable(context.db, dayMs, resourceId, startMin, endMin)
        if (!bookable) {
          return new Response(null, {
            status: 302,
            headers: { Location: buildErrorRedirectUrl(parsed, { editing: id, formError: 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.' }) },
          })
        }

        let during = `[${startMin},${endMin})`
        let now = Date.now()

        try {
          let result = await pool.query(
            `UPDATE appointments
             SET user_id = $1, resource_id = $2, title = $3, date = $4, during = $5, updated_at = $6
             WHERE id = $7`,
            [userId, resourceId, title, dayMs, during, now, id],
          )

          if (result.rowCount === 0) {
            return new Response(null, {
              status: 302,
              headers: { Location: buildErrorRedirectUrl(parsed, { editing: id, formError: 'Eintrag nicht gefunden.' }) },
            })
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
              details: { resource_id: resourceId, user_id: userId, title, date: parsed.date, during },
            })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            return new Response(null, {
              status: 302,
              headers: { Location: buildErrorRedirectUrl(parsed, { editing: id, formError: 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.' }) },
            })
          }
          throw error
        }

        // Broadcast invalidation so other sessions reload
        appointmentChannel.broadcast('invalidate')

        // Redirect back with preserved grid state
        let params = gridStateToParams(gridStateFromForm(parsed))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/appointments' + (qs ? '?' + qs : '') },
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
          headers: { Location: '/admin/appointments' + (qs ? '?' + qs : '') },
        })
      },

      async events(context) {
        return appointmentChannel.subscribe(context.request)
      },
    },
  },
)
