import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, queryRow } from './rows.ts'

const userEmailRowSchema = z.object({
  id: z.number(),
  email: z.string(),
})

export type UserEmailRow = z.output<typeof userEmailRowSchema>

export async function listUserEmails(db: Database, userIds: number[]): Promise<UserEmailRow[]> {
  return await queryRows(
    db,
    sql`SELECT id, email FROM users WHERE id = ANY(${userIds}::int[])`,
    userEmailRowSchema,
  )
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
  let row = await queryRow(
    db,
    sql`INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
     SELECT user_id, ${data.resourceId}, title, ${data.date}::bigint, int4range(${data.startMin}::integer, ${data.startMin}::integer + 15, '[)'), ${data.now}, ${data.now}
     FROM appointtypes
     WHERE id = ${data.typeId} AND user_id = ${data.userId}
     RETURNING id`,
    z.object({ id: z.number() }),
  )
  return row?.id
}
