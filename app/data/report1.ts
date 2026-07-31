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

export const REPORT1_SORTABLE_FIELDS: readonly string[] = [
  'name',
  'count',
  'min_date',
  'max_date',
  'total_hours',
  'avg_hours',
]

const ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'u.name',
  count: 'COUNT(*)::int',
  min_date: 'MIN(a.date)',
  max_date: 'MAX(a.date)',
  total_hours: 'SUM(a.end_min - a.start_min)',
  avg_hours: 'SUM(a.end_min - a.start_min)::numeric / NULLIF(COUNT(*), 0)',
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
  let {
    monthStart,
    monthEnd,
    selectedUserId,
    filter,
    column,
    direction,
    effectivePageSize,
    offset,
  } = opts

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

  let sortExpr = ORDER_BY_COLUMNS[column]
  if (!sortExpr) {
    throw new Error(`Invalid report1 sort column: ${column}`)
  }

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
