import { type Database } from 'remix/data-table'

export interface UserSummaryRow {
  user_id: number
  name: string
  email: string
  appointment_count: number
  total_minutes: number
  first_date: number | null
  last_date: number | null
}

export interface ListUserSummariesOptions {
  /** Optional start boundary (ms epoch). When set, only users with appointments in the range are returned. */
  startMs?: number
  /** Optional end boundary (ms epoch, exclusive). */
  endMs?: number
  limit?: number
}

export async function listUserSummaries(
  db: Database,
  options: ListUserSummariesOptions = {},
): Promise<UserSummaryRow[]> {
  let { startMs, endMs, limit = 10000 } = options
  let hasRange = startMs != null && endMs != null
  let join = hasRange ? 'INNER JOIN' : 'LEFT JOIN'
  let where = hasRange ? 'WHERE a.date >= $1 AND a.date < $2' : ''
  let params: unknown[] = hasRange ? [startMs, endMs, limit] : [limit]

  let result = await db.exec(
    `SELECT u.id AS user_id, u.name, u.email,
            COUNT(a.id)::int AS appointment_count,
            COALESCE(SUM(a.end_min - a.start_min), 0)::int AS total_minutes,
            MIN(a.date) AS first_date,
            MAX(a.date) AS last_date
     FROM users u
     ${join} appointments a ON a.user_id = u.id
     ${where}
     GROUP BY u.id, u.name, u.email
     ORDER BY u.name ASC
     LIMIT $${hasRange ? 3 : 1}`,
    params,
  )
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => ({
    user_id: Number(row.user_id),
    name: row.name as string,
    email: row.email as string,
    appointment_count: Number(row.appointment_count),
    total_minutes: Number(row.total_minutes),
    first_date: row.first_date != null ? Number(row.first_date) : null,
    last_date: row.last_date != null ? Number(row.last_date) : null,
  }))
}
