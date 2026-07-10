import { gte, lt, type Database } from 'remix/data-table'

import { appointments, type Appointment } from './schema.ts'
import {
  isDateInPast,
  isWithinHours,
  getPeriodRange,
  getTodayUtcMidnight,
} from '../utils/date-utils.ts'

// ═══════════════════════════════════════════════════════════════════
// 1. Data-table adapter (user-scoped CRUD)
// ═══════════════════════════════════════════════════════════════════

interface AppointmentInput {
  title: string
  date: number
  start_min: number
  end_min: number
  resource_id: number
}

interface AppointmentUpdate {
  title?: string
  date?: number
  start_min?: number
  end_min?: number
  resource_id?: number
}

export class AppointmentError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class AppointmentCollisionError extends AppointmentError {
  constructor() {
    super('Time slot already taken.', 409)
  }
}

class AppointmentPastDateError extends AppointmentError {
  constructor() {
    super('Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden.', 422)
  }
}

class AppointmentPastDeleteError extends AppointmentError {
  constructor() {
    super('Termine können nur bis 24 Stunden vor Beginn gelöscht werden.', 403)
  }
}

class AppointmentTooCloseError extends AppointmentError {
  constructor() {
    super('Termine können nur bis 24 Stunden vor Beginn bearbeitet werden.', 422)
  }
}

interface UpdateAppointmentOptions {
  /** Skip user_id scope check and 24h cancellation check (admin bypass). */
  adminBypass?: boolean
}

interface DeleteAppointmentOptions {
  /** Skip user_id scope check and 24h cancellation check (admin bypass). */
  adminBypass?: boolean
}

/** Minimum hours before appointment start for non-admin update/delete. */
const CANCELLATION_WINDOW_HOURS = 24

/**
 * Compute the appointment start time in epoch ms from its day-level date and start_min.
 */
function appointmentStartMs(date: number, startMin: number): number {
  return date + startMin * 60000
}

/** PostgreSQL exclusion violation error code */
const PG_EXCLUSION_VIOLATION = '23P01'

/**
 * Check if an error is a PostgreSQL exclusion constraint violation
 * (wrapped by the data-table adapter).
 */
export function isExclusionViolation(error: unknown): boolean {
  // The data-table wraps PostgreSQL errors in DataTableAdapterError,
  // with the original error in `.cause`
  let cause: unknown = error
  while (cause instanceof Error && 'cause' in cause && cause.cause != null) {
    cause = (cause as Error).cause
  }
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code: string }).code === PG_EXCLUSION_VIOLATION
  )
}

export async function listAppointmentsByWeek(
  db: Database,
  weekStart: number,
  weekEnd: number,
  resourceId?: number,
): Promise<Appointment[]> {
  let query = db.query(appointments).where(gte('date', weekStart)).where(lt('date', weekEnd))

  if (resourceId !== undefined) {
    query = query.where({ resource_id: resourceId })
  }

  return await query.orderBy('date', 'asc').orderBy('start_min', 'asc').all()
}

export async function createAppointment(
  db: Database,
  userId: number,
  input: AppointmentInput,
): Promise<Appointment> {
  if (isDateInPast(input.date)) {
    throw new AppointmentPastDateError()
  }

  try {
    let result = await db.create(
      appointments,
      {
        user_id: userId,
        resource_id: input.resource_id,
        title: input.title.trim(),
        date: input.date,
        start_min: input.start_min,
        end_min: input.end_min,
      },
      { returnRow: true },
    )
    return result as Appointment
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppointmentCollisionError()
    }
    throw error
  }
}

export async function updateAppointment(
  db: Database,
  userId: number,
  appointmentId: number,
  input: AppointmentUpdate,
  options?: UpdateAppointmentOptions,
): Promise<Appointment> {
  let query: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    query.user_id = userId
  }
  let existing = await db.findOne(appointments, { where: query })
  if (!existing) {
    throw new AppointmentError('Appointment not found.', 404)
  }

  // Enforce 24h cancellation policy for non-admin users:
  // appointment can only be updated if its start time is at least 24h in the future.
  if (!options?.adminBypass) {
    let startMs = appointmentStartMs(Number(existing.date), existing.start_min as number)
    if (!isWithinHours(startMs, CANCELLATION_WINDOW_HOURS)) {
      throw new AppointmentTooCloseError()
    }
  }

  let update: Record<string, unknown> = {}
  if (input.title !== undefined) update.title = input.title.trim()
  if (input.date !== undefined) update.date = input.date
  if (input.start_min !== undefined) update.start_min = input.start_min
  if (input.end_min !== undefined) update.end_min = input.end_min
  if (input.resource_id !== undefined) update.resource_id = input.resource_id

  try {
    return await db.update(appointments, query as { id: number }, update)
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppointmentCollisionError()
    }
    throw error
  }
}

export async function deleteAppointment(
  db: Database,
  userId: number,
  appointmentId: number,
  options?: DeleteAppointmentOptions,
): Promise<void> {
  let query: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    query.user_id = userId
  }
  let existing = await db.findOne(appointments, { where: query })
  if (!existing) {
    throw new AppointmentError('Appointment not found.', 404)
  }

  // Enforce 24h cancellation policy for non-admin users:
  // appointment can only be deleted if its start time is at least 24h in the future.
  if (!options?.adminBypass) {
    let startMs = appointmentStartMs(Number(existing.date), existing.start_min as number)
    if (!isWithinHours(startMs, CANCELLATION_WINDOW_HOURS)) {
      throw new AppointmentPastDeleteError()
    }
  }

  let deleteQuery: Record<string, unknown> = { id: appointmentId }
  if (!options?.adminBypass) {
    deleteQuery.user_id = userId
  }
  await db.query(appointments).where(deleteQuery).delete()
}

// ═══════════════════════════════════════════════════════════════════
// 2. Raw SQL admin functions
//    (imported by app/actions/verwaltung/appointments/controller.tsx)
// ═══════════════════════════════════════════════════════════════════

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

export async function fetchAppointmentEditRow(
  db: Database,
  id: string,
): Promise<AppointmentRow | undefined> {
  let result = await db.exec(
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
  return (result.rows ?? []).length > 0 ? (result.rows![0] as unknown as AppointmentRow) : undefined
}

export interface ListAppointmentsOpts {
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
  period?: string
  status?: string
}

const ADMIN_ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'u.email': 'u.email',
  'r.description': 'r.name', // UI "description" column sorts by resource name
  'a.date': 'a.date',
  'a.during': 'a.during',
  'a.created_at': 'a.created_at',
  'a.updated_at': 'a.updated_at',
}

const ADMIN_SEARCH_COLUMNS = ['a.title', 'u.email', 'r.description', 'r.name'] as const

export async function listAppointments(
  db: Database,
  opts: ListAppointmentsOpts,
): Promise<{ rows: AppointmentRow[]; hasMore: boolean }> {
  let { offset, pageSize, column, direction, filter, period, status } = opts

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
    let esc = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    let searchPattern = `%${esc}%`
    let conditions = ADMIN_SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
    addWhere(`(${conditions.join(' OR ')})`)
    params.push(searchPattern)
  }

  let periodRange = period ? getPeriodRange(period) : null
  if (periodRange) {
    paramIndex++
    addWhere(`a.date >= $${paramIndex}`)
    params.push(periodRange.startMs)

    paramIndex++
    addWhere(`a.date < $${paramIndex}`)
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
  query += ` ORDER BY ${ADMIN_ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await db.exec(query, params)
  let rows = (result.rows ?? []) as unknown as AppointmentRow[]
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function listResourcesForAppointments(
  db: Database,
): Promise<AppointmentResourceOption[]> {
  let result = await db.exec('SELECT id, name, description FROM resources ORDER BY name ASC')
  return (result.rows ?? []) as unknown as AppointmentResourceOption[]
}

export async function listUsersForAppointments(db: Database): Promise<AppointmentUserOption[]> {
  let result = await db.exec('SELECT id, name FROM users ORDER BY name ASC')
  return (result.rows ?? []) as unknown as AppointmentUserOption[]
}

export async function adminCreateAppointment(
  db: Database,
  data: {
    title: string
    userId: number
    resourceId: number
    date: number
    during: string
  },
): Promise<number> {
  let now = Date.now()
  let result = await db.exec(
    `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [data.userId, data.resourceId, data.title, data.date, data.during, now, now],
  )
  let row = result.rows?.[0] as { id: number } | undefined
  if (!row) throw new Error('adminCreateAppointment: INSERT … RETURNING produced no row')
  return row.id
}

export async function adminUpdateAppointment(
  db: Database,
  id: string,
  data: {
    title: string
    userId: number
    resourceId: number
    date: number
    during: string
  },
): Promise<boolean> {
  let now = Date.now()
  let result = await db.exec(
    `UPDATE appointments
     SET user_id = $1, resource_id = $2, title = $3, date = $4, during = $5, updated_at = $6
     WHERE id = $7`,
    [data.userId, data.resourceId, data.title, data.date, data.during, now, id],
  )
  return (result.affectedRows ?? 0) > 0
}

export async function adminDeleteAppointment(db: Database, id: string): Promise<boolean> {
  let result = await db.exec('DELETE FROM appointments WHERE id = $1', [id])
  return (result.affectedRows ?? 0) > 0
}

// ═══════════════════════════════════════════════════════════════════
// 3. Booking flow raw SQL functions
//    (imported by app/actions/appointments-new/controller.tsx
//     and app/actions/mastra/workflows/)
// ═══════════════════════════════════════════════════════════════════

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
  created_at?: string
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

export async function listResources(db: Database): Promise<ResourceOption[]> {
  let result = await db.exec('SELECT id, name, description FROM resources ORDER BY name ASC')
  return (result.rows ?? []) as unknown as ResourceOption[]
}

export const APPOINTMENTS_NEW_PAGE_SIZE = 15

export const APPOINTMENTS_NEW_ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'r.name': 'r.name',
  'a.date': 'a.date',
  'a.during': 'a.during',
}

export interface ListAppointmentsNewOpts {
  userId: number
  offset: number
  pageSize: number
  column: string
  direction: 'asc' | 'desc'
  period?: string
  status?: string
}

export async function listAppointmentsNew(
  db: Database,
  opts: ListAppointmentsNewOpts,
): Promise<{ rows: AppointmentsNewRow[]; hasMore: boolean }> {
  let { userId, offset, pageSize, column, direction, period, status } = opts

  let query = `
    SELECT a.id, a.title,
           a.resource_id, r.name AS resource_name, r.description AS resource_description,
           a.date, during::text AS during, a.start_min, a.end_min, a.created_at
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
  query += ` ORDER BY ${APPOINTMENTS_NEW_ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}, a.start_min ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await db.exec(query, params)
  let rows = (result.rows ?? []) as unknown as AppointmentsNewRow[]
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function checkResourceExists(db: Database, resourceId: number): Promise<boolean> {
  let result = await db.exec('SELECT 1 FROM resources WHERE id = $1', [resourceId])
  return (result.rows ?? []).length > 0
}

export async function getAppointmentForDelete(
  db: Database,
  id: string,
  userId: number,
): Promise<AppointmentsNewRow | undefined> {
  let result = await db.exec(
    `SELECT a.id, a.title,
            a.resource_id, r.name AS resource_name, r.description AS resource_description,
            a.date, during::text AS during, a.start_min, a.end_min, a.created_at
     FROM appointments a
     LEFT JOIN resources r ON r.id = a.resource_id
     WHERE a.id = $1 AND a.user_id = $2`,
    [id, userId],
  )
  return (result.rows ?? []).length > 0
    ? (result.rows![0] as unknown as AppointmentsNewRow)
    : undefined
}

export async function createAppointmentRecord(
  db: Database,
  data: {
    userId: number
    resourceId: number
    title: string
    dayMs: number
    during: string
    now: number
  },
): Promise<number> {
  let result = await db.exec(
    `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [data.userId, data.resourceId, data.title, data.dayMs, data.during, data.now, data.now],
  )
  let row = result.rows?.[0] as { id: number } | undefined
  if (!row) throw new Error('createAppointmentRecord: INSERT … RETURNING produced no row')
  return row.id
}

export async function getAppointmentRow(
  db: Database,
  id: string,
  userId: number,
): Promise<{ date: string; start_min: number; created_at: string } | undefined> {
  let result = await db.exec(
    'SELECT date, start_min, created_at FROM appointments WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  return (result.rows ?? []).length > 0
    ? (result.rows![0] as unknown as { date: string; start_min: number; created_at: string })
    : undefined
}

export async function deleteAppointmentRecord(
  db: Database,
  id: string,
  userId: number,
): Promise<boolean> {
  let result = await db.exec('DELETE FROM appointments WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ])
  return (result.affectedRows ?? 0) > 0
}
