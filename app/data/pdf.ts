import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows } from './rows.ts'

export interface AppointmentRow {
  id: number
  user_name: string | null
  user_email: string
  resource_name: string | null
  resource_description: string | null
  title: string
  date: number
  start_min: number
  end_min: number
}

const appointmentRowSchema = z.object({
  id: z.number(),
  user_name: z.string().nullable(),
  user_email: z.string(),
  resource_name: z.string().nullable(),
  resource_description: z.string().nullable(),
  title: z.string(),
  date: z.string(),
  start_min: z.number(),
  end_min: z.number(),
})

export async function listAllAppointments(
  db: Database,
  limit: number = 10000,
): Promise<{ rows: AppointmentRow[]; truncated: boolean }> {
  let rows = (
    await queryRows(
      db,
      sql`SELECT a.id, u.name AS user_name, u.email AS user_email,
            r.name AS resource_name, r.description AS resource_description,
            a.title, a.date, a.start_min, a.end_min
     FROM appointments a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN resources r ON r.id = a.resource_id
     ORDER BY a.date ASC, a.start_min ASC
     LIMIT ${limit + 1}`,
      appointmentRowSchema,
    )
  ).map((row) => ({
    id: row.id,
    user_name: row.user_name,
    user_email: row.user_email,
    resource_name: row.resource_name,
    resource_description: row.resource_description,
    title: row.title,
    date: Number(row.date),
    start_min: row.start_min,
    end_min: row.end_min,
  }))
  let truncated = rows.length > limit
  if (truncated) rows = rows.slice(0, limit)
  return { rows, truncated }
}
