import { rawSql, sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, int8Aggregate } from './rows.ts'

const report1RowSchema = z.object({
  user_id: z.number(),
  user_name: z.string(),
  user_email: z.string(),
  appointment_count: int8Aggregate,
  min_date: int8Aggregate.nullable(),
  max_date: int8Aggregate.nullable(),
  total_min: int8Aggregate.nullable(),
  avg_min: int8Aggregate.nullable(),
})

export type Report1Row = z.output<typeof report1RowSchema>

const report1UserOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export type Report1UserOption = z.output<typeof report1UserOptionSchema>

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
  query += ` ORDER BY ${sortExpr} ${direction === 'desc' ? 'DESC' : 'ASC'}, u.id DESC`
  query += ` LIMIT $${paramIndex}`
  params.push(effectivePageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let rows = await queryRows(db, rawSql(query, params), report1RowSchema)
  let hasMore = rows.length > effectivePageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function listReport1Users(db: Database): Promise<Report1UserOption[]> {
  return await queryRows(
    db,
    sql`SELECT id, name FROM users ORDER BY name ASC`,
    report1UserOptionSchema,
  )
}
