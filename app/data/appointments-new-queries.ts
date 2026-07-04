import { type Database } from 'remix/data-table'
import { getPeriodRange, getTodayUtcMidnight } from '../utils/date-utils.ts'

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
  let result = await db.exec(
    'SELECT id, name, description FROM resources ORDER BY name ASC',
  )
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

export async function checkResourceExists(
  db: Database,
  resourceId: number,
): Promise<boolean> {
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
  data: { userId: number; resourceId: number; title: string; dayMs: number; during: string; now: number },
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
  let result = await db.exec(
    'DELETE FROM appointments WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  return (result.affectedRows ?? 0) > 0
}
