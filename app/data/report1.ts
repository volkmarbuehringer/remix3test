import { type Database } from 'remix/data-table'

export interface Report1Row {
  user_id: string
  user_name: string
  user_email: string
  appointment_count: string
  min_date: string | null
  max_date: string | null
  total_min: string | null
  avg_min: string | null
}

export interface Report1UserOption {
  id: string
  name: string
}

export const REPORT1_PAGE_SIZE = 20

export const REPORT1_SORTABLE_FIELDS: readonly string[] = ['u.name', 'u.email', 'total_appointments', 'total_offerings', 'first_appointment', 'last_appointment', 'percentage']

const ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'u.name',
  count: 'appointment_count',
  min_date: 'min_date',
  max_date: 'max_date',
  total_hours: 'appointment_count',
  avg_hours: 'appointment_count',
}

export interface RunReport1Opts {
  monthStart: number
  monthEnd: number
  selectedUserId?: number
  filter?: string
  column: string
  direction: 'asc' | 'desc'
  effectivePageSize: number
  offset: number
}

export async function runReport1(
  db: Database,
  opts: RunReport1Opts,
): Promise<{ rows: Report1Row[]; hasMore: boolean }> {
  let { monthStart, monthEnd, selectedUserId, filter, column, direction, effectivePageSize, offset } = opts

  let query = `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
                      COUNT(*)::int AS appointment_count,
                      MIN(a.date) AS min_date,
                      MAX(a.date) AS max_date,
                      SUM(a.end_min - a.start_min) AS total_min,
                      ROUND(SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0), 1) AS avg_min
               FROM appointments a
               INNER JOIN users u ON u.id = a.user_id`

  let params: unknown[] = []
  let paramIndex = 0
  let conditions: string[] = []

  paramIndex++
  conditions.push(`a.date >= $${paramIndex}`)
  params.push(monthStart)

  paramIndex++
  conditions.push(`a.date < $${paramIndex}`)
  params.push(monthEnd)

  if (selectedUserId !== undefined) {
    paramIndex++
    conditions.push(`a.user_id = $${paramIndex}`)
    params.push(selectedUserId)
  }

  if (filter && filter.length <= 200) {
    paramIndex++
    let esc = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    conditions.push(`u.name ILIKE $${paramIndex}`)
    params.push(`%${esc}%`)
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`
  }

  query += ` GROUP BY u.id, u.name, u.email`

  let sortExpr = ORDER_BY_COLUMNS[column] || 'u.name'
  if (column === 'count') sortExpr = `COUNT(*)::int`
  if (column === 'min_date') sortExpr = `MIN(a.date)`
  if (column === 'max_date') sortExpr = `MAX(a.date)`
  if (column === 'total_hours') sortExpr = `SUM(a.end_min - a.start_min)`
  if (column === 'avg_hours') sortExpr = `SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0)`

  paramIndex++
  query += ` ORDER BY ${sortExpr} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(effectivePageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await db.exec(query, params)
  let rows = (result.rows ?? []) as unknown as Report1Row[]
  let hasMore = rows.length > effectivePageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function listReport1Users(db: Database): Promise<Report1UserOption[]> {
  let result = await db.exec('SELECT id, name FROM users ORDER BY name ASC')
  return (result.rows ?? []) as unknown as Report1UserOption[]
}
