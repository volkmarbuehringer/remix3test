import { type Database } from 'remix/data-table'

import { type UserSummaryRow, queryUserSummaryRows } from './user-summary-rows.ts'

export type { UserSummaryRow }

export async function listUserSummaries(
  db: Database,
  limit: number = 10000,
): Promise<{ rows: UserSummaryRow[]; truncated: boolean }> {
  return queryUserSummaryRows(
    db,
    `SELECT u.id AS user_id, u.name, u.email,
            COUNT(a.id)::int AS appointment_count,
            COALESCE(SUM(a.end_min - a.start_min), 0)::int AS total_minutes,
            MIN(a.date) AS first_date,
            MAX(a.date) AS last_date
     FROM users u
     LEFT JOIN appointments a ON a.user_id = u.id
     GROUP BY u.id, u.name, u.email
     ORDER BY u.name ASC
     LIMIT $1`,
    [limit + 1],
    limit,
  )
}
