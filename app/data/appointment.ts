import { type Database } from 'remix/data-table'

export interface UserEmailRow {
  id: number
  email: string
}

export async function listUserEmails(db: Database, userIds: number[]): Promise<UserEmailRow[]> {
  let result = await db.exec('SELECT id, email FROM users WHERE id = ANY($1::int[])', [userIds])
  return (result.rows ?? []) as unknown as UserEmailRow[]
}

export async function createAppointmentFromType(
  db: Database,
  data: {
    date: number
    startMin: number
    now: number
    typeId: number
    userId: number
    resourceId: number
  },
): Promise<number | undefined> {
  let result = await db.exec(
    `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
     SELECT user_id, $6, title, $1::bigint, int4range($2::integer, $2::integer + 15, '[)'), $3, $3
     FROM appointtypes
     WHERE id = $4 AND user_id = $5
     RETURNING id`,
    [data.date, data.startMin, data.now, data.typeId, data.userId, data.resourceId],
  )
  return (result.rows ?? []).length > 0 ? (result.rows![0] as { id: number }).id : undefined
}
