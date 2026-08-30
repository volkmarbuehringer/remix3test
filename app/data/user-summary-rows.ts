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

/**
 * Execute a user-summary aggregate query (per-user appointment COUNT/SUM/
 * MIN/MAX) and map + truncate its rows. The SQL differs between callers
 * (LEFT JOIN for all users vs INNER JOIN for a date range) and stays with
 * the caller; only the shared row coercion and limit+1 truncation live here.
 */
export async function queryUserSummaryRows(
  db: Database,
  sql: string,
  params: unknown[],
  limit: number,
): Promise<{ rows: UserSummaryRow[]; truncated: boolean }> {
  let result = await db.exec(sql, params)
  let rows = ((result.rows ?? []) as Record<string, unknown>[]).map((row) => ({
    user_id: Number(row.user_id),
    name: row.name as string,
    email: row.email as string,
    appointment_count: Number(row.appointment_count),
    total_minutes: Number(row.total_minutes),
    first_date: row.first_date != null ? Number(row.first_date) : null,
    last_date: row.last_date != null ? Number(row.last_date) : null,
  }))
  let truncated = rows.length > limit
  if (truncated) rows = rows.slice(0, limit)
  return { rows, truncated }
}
