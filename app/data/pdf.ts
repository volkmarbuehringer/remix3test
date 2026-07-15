import { type Database } from 'remix/data-table'

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

export async function listAllAppointments(
  db: Database,
  limit: number = 10000,
): Promise<AppointmentRow[]> {
  let result = await db.exec(
    `SELECT a.id, u.name AS user_name, u.email AS user_email,
            r.name AS resource_name, r.description AS resource_description,
            a.title, a.date, a.start_min, a.end_min
     FROM appointments a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN resources r ON r.id = a.resource_id
     ORDER BY a.date ASC, a.start_min ASC
     LIMIT $1`,
    [limit],
  )
  return ((result.rows ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    user_name: (row.user_name as string) ?? null,
    user_email: row.user_email as string,
    resource_name: (row.resource_name as string) ?? null,
    resource_description: (row.resource_description as string) ?? null,
    title: row.title as string,
    date: Number(row.date),
    start_min: Number(row.start_min),
    end_min: Number(row.end_min),
  }))
}
