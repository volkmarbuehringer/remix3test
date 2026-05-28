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

const SORTABLE_COLUMNS = [
  'a.id',
  'a.title',
  'u.email',
  'r.description',
  'a.date',
  'a.during',
  'a.created_at',
  'a.updated_at',
] as const

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

function validateAppointmentForm(parsed: Record<string, string>): string | null {
  let resourceId = parseInt(parsed.resource_id, 10)
  if (!resourceId || isNaN(resourceId)) {
    return 'Ressource ist erforderlich.'
  }

  let userId = parseInt(parsed.user_id, 10)
  if (!userId || isNaN(userId)) {
    return 'Benutzer ist erforderlich.'
  }

  if (!parsed.title || parsed.title.trim().length === 0) {
    return 'Titel ist erforderlich.'
  }

  if (!parsed.date || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return 'Gültiges Datum erforderlich (YYYY-MM-DD).'
  }

  let startMin = parseInt(parsed.start_min, 10)
  if (isNaN(startMin) || startMin < 0 || startMin > 1380 || startMin % 15 !== 0) {
    return 'Startzeit ist ungültig.'
  }

  let endMin = parseInt(parsed.end_min, 10)
  if (isNaN(endMin) || endMin < 60 || endMin > 1440 || endMin % 15 !== 0) {
    return 'Endzeit ist ungültig.'
  }

  if (endMin <= startMin) {
    return 'Endzeit muss nach der Startzeit liegen.'
  }

  return null
}

function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string; constraint?: string }
    console.error('=== isExclusionConstraintError CHECK ===')
    console.error('  typeof error:', typeof error)
    console.error('  constructor:', (error as any)?.constructor?.name)
    console.error('  is Error:', error instanceof Error)
    console.error('  keys:', Object.keys(error))
    console.error('  constraint:', err.constraint, '=== no_overlapping_seats?', err.constraint === 'no_overlapping_seats')
    console.error('  code:', err.code, '=== 23P01?', err.code === '23P01')
    console.error('  message:', (err.message ?? '').substring(0, 200), 'includes conflicts?', (err.message ?? '').includes('conflicts with key'))
    let result =
      err.constraint === 'no_overlapping_seats' ||
      err.code === '23P01' ||
      (err.message ?? '').includes('conflicts with key')
    console.error('  RESULT:', result)
    return result
  }
  console.error('=== isExclusionConstraintError: not an object or falsy ===')
  return false
}

// ── Shared error helpers ─────────────────────────────────────────

/**
 * Build a redirect response that preserves grid state and shows an error message.
 * Used by create and update actions to return validation/error feedback
 * that the admin page can display as a form error.
 */
function errorRedirect(
  parsed: Record<string, string>,
  error: string,
  extra?: { creating?: boolean; editing?: string },
): Response {
  let state = {
    offset: parsed._offset,
    sort: parsed._sort,
    order: parsed._order,
    filter: parsed._filter,
  }
  let params = gridStateToParams(state)
  if (extra?.creating) params.set('creating', 'true')
  if (extra?.editing) params.set('editing', extra.editing)
  params.set('error', error)
  let qs = params.toString()
  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/appointments' + (qs ? '?' + qs : '') },
  })
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

// ── Controller ───────────────────────────────────────────────────

export default createController<typeof routes.admin.appointments, AppContext>(
  routes.admin.appointments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async index(context) {
        let offset = Math.max(
          0,
          Number(context.url.searchParams.get('offset')) || 0,
        )
        let filter = context.url.searchParams.get('filter') || undefined

        let { column, direction } = parseSort(context.url, {
          allowedColumns: SORTABLE_COLUMNS,
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
        query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`
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
        let editingParam = context.url.searchParams.get('editing')
        let editingRowId = editingParam || null
        let editRow: AppointmentRow | null = null
        if (editingRowId) {
          let editResult = await pool.query(
            `SELECT a.id, a.title, a.user_id, u.email AS user_email,
                    a.resource_id, r.description AS resource_description,
                    a.date, during::text AS during, a.start_min, a.end_min,
                    a.created_at, a.updated_at
             FROM appointments a
             INNER JOIN users u ON u.id = a.user_id
             LEFT JOIN resources r ON r.id = a.resource_id
             WHERE a.id = $1`,
            [editingRowId],
          )
          if (editResult.rows.length > 0) {
            editRow = editResult.rows[0] as AppointmentRow
          }
        }

        let creating =
          context.url.searchParams.get('creating') === 'true'

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

        let error = context.url.searchParams.get('error') || undefined

        return renderAdminPage(
          context.render,
          'appointments',
          <AdminAppointmentsPage
            rows={rows}
            offset={offset}
            hasMore={hasMore}
            prevOffset={Math.max(0, offset - PAGE_SIZE)}
            nextOffset={offset + PAGE_SIZE}
            sortColumn={column}
            sortDirection={direction}
            filter={filter}
            editRow={editRow}
            creating={creating}
            resources={resources}
            users={users}
            error={error}
            defaultStartMin={defaultStartMin}
            defaultEndMin={defaultEndMin}
          />,
        )
      },

      async create(context) {
        let formData = context.formData

        // Rate limiting
        let auth = context.auth
        if (auth?.ok) {
          let authUserId = (auth.identity as { id: number }).id
          if (!adminCreateLimiter.attempt(authUserId)) {
            return errorRedirect({ _offset: '', _sort: '', _order: '', _filter: '' }, 'Bitte warten Sie, bevor Sie einen weiteren Termin anlegen.', { creating: true })
          }
        }

        let parsed: Record<string, string>
        try {
          parsed = s.parse(appointmentSaveSchema, formData) as Record<string, string>
        } catch {
          return errorRedirect({ _offset: '', _sort: '', _order: '', _filter: '' }, 'Ungültige Formulardaten.', { creating: true })
        }

        let validationError = validateAppointmentForm(parsed)
        if (validationError) {
          return errorRedirect(parsed, validationError, { creating: true })
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let userId = parseInt(parsed.user_id, 10)
        let title = parsed.title.trim()
        let dayMs = new Date(parsed.date + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date creation
        if (isDateInPast(dayMs)) {
          return errorRedirect(parsed, 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.', { creating: true })
        }

        // Validate that the requested slot is within an offering
        let bookable = await isSlotBookable(context.db, dayMs, resourceId, startMin, endMin)
        if (!bookable) {
          return errorRedirect(parsed, 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.', { creating: true })
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
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            return errorRedirect(parsed, 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.', { creating: true })
          }
          throw error
        }

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
            return errorRedirect({ _offset: '', _sort: '', _order: '', _filter: '' }, 'Bitte warten Sie, bevor Sie einen Termin bearbeiten.', { editing: updateId ?? undefined })
          }
        }

        let parsed: Record<string, string>
        try {
          parsed = s.parse(appointmentSaveSchema, formData) as Record<string, string>
        } catch {
          return errorRedirect({ _offset: '', _sort: '', _order: '', _filter: '' }, 'Ungültige Formulardaten.', { editing: updateId ?? undefined })
        }

        let id = context.params.id

        if (!id) {
          return errorRedirect(parsed, 'Ungültige ID.')
        }

        let validationError = validateAppointmentForm(parsed)
        if (validationError) {
          return errorRedirect(parsed, validationError, { editing: id })
        }

        let resourceId = parseInt(parsed.resource_id, 10)
        let userId = parseInt(parsed.user_id, 10)
        let title = parsed.title.trim()
        let dayMs = new Date(parsed.date + 'T00:00:00Z').getTime()
        let startMin = parseInt(parsed.start_min, 10)
        let endMin = parseInt(parsed.end_min, 10)

        // Reject past-date update
        if (isDateInPast(dayMs)) {
          return errorRedirect(parsed, 'Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.', { editing: id })
        }

        // Validate that the requested slot is within an offering
        let bookable = await isSlotBookable(context.db, dayMs, resourceId, startMin, endMin)
        if (!bookable) {
          return errorRedirect(parsed, 'Der gewünschte Zeitraum liegt außerhalb der Buchungszeiten.', { editing: id })
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
            return errorRedirect(parsed, 'Eintrag nicht gefunden.', { editing: id })
          }
        } catch (error: unknown) {
          if (isExclusionConstraintError(error)) {
            return errorRedirect(parsed, 'Dieser Zeitraum überschneidet sich mit einem bestehenden Termin.', { editing: id })
          }
          throw error
        }

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

        // Redirect back with preserved grid state
        let params = gridStateToParams(gridStateFromFormData(formData))
        let qs = params.toString()
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/appointments' + (qs ? '?' + qs : '') },
        })
      },
    },
  },
)
