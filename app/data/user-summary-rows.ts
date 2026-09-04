import { rawSql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, int8Aggregate } from './rows.ts'

const userSummaryRowSchema = z.object({
  user_id: z.number(),
  name: z.string(),
  email: z.string(),
  appointment_count: int8Aggregate,
  total_minutes: int8Aggregate,
  first_date: int8Aggregate.nullable(),
  last_date: int8Aggregate.nullable(),
})

export type UserSummaryRow = z.output<typeof userSummaryRowSchema>

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
  let rows = await queryRows(db, rawSql(sql, params), userSummaryRowSchema)
  let truncated = rows.length > limit
  if (truncated) rows = rows.slice(0, limit)
  return { rows, truncated }
}
