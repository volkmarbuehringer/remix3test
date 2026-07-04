import { type Database } from 'remix/data-table'
import { getPeriodRange, getTodayUtcMidnight } from '../utils/date-utils.ts'

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

export async function fetchAppointmentEditRow(db: Database, id: string): Promise<AppointmentRow | undefined> {
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

const ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  'u.email': 'u.email',
  'r.description': 'r.name', // UI "description" column sorts by resource name
  'a.date': 'a.date',
  'a.during': 'a.during',
  'a.created_at': 'a.created_at',
  'a.updated_at': 'a.updated_at',
}

const SEARCH_COLUMNS = ['a.title', 'u.email', 'r.description', 'r.name'] as const

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
    let conditions = SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
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
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
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

export async function listResourcesForAppointments(db: Database): Promise<AppointmentResourceOption[]> {
  let result = await db.exec('SELECT id, name, description FROM resources ORDER BY name ASC')
  return (result.rows ?? []) as unknown as AppointmentResourceOption[]
}

export async function listUsersForAppointments(db: Database): Promise<AppointmentUserOption[]> {
  let result = await db.exec('SELECT id, name FROM users ORDER BY name ASC')
  return (result.rows ?? []) as unknown as AppointmentUserOption[]
}

export async function createAppointment(
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
  if (!row) throw new Error('createAppointment: INSERT … RETURNING produced no row')
  return row.id
}

export async function updateAppointment(
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

export async function deleteAppointment(db: Database, id: string): Promise<boolean> {
  let result = await db.exec('DELETE FROM appointments WHERE id = $1', [id])
  return (result.affectedRows ?? 0) > 0
}
