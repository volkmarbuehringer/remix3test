import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { notifications, type Notification } from './schema.ts'
import { queryRows, queryRow, int8Aggregate } from './rows.ts'

const NOTIFICATION_TYPES = ['confirmation', 'reminder', 'cancellation'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface CreateNotificationInput {
  userId: number
  type: NotificationType
  title?: string | undefined
  body?: string | undefined
  appointmentId?: number | undefined
}

const notificationWireSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  appointment_id: z.number().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
})

function toNotification(row: z.output<typeof notificationWireSchema>): Notification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    appointment_id: row.appointment_id,
    read_at: row.read_at === null ? null : Number(row.read_at),
    created_at: Number(row.created_at),
  }
}

/** Persist a notification row for a user. Returns the created row. */
export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
): Promise<Notification | null> {
  let row = await queryRow(
    db,
    sql`INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
     VALUES (${input.userId}, ${input.type}, ${input.title ?? ''}, ${input.body ?? ''}, ${input.appointmentId ?? null}, NULL, ${Date.now()})
     RETURNING id`,
    z.object({ id: z.number() }),
  )
  if (!row) return null
  return await findNotification(db, row.id, input.userId)
}

export interface ListNotificationsOptions {
  pageSize?: number
  offset?: number
}

/** List a user's notifications newest-first, with pagination. */
export async function listUserNotifications(
  db: Database,
  userId: number,
  options: ListNotificationsOptions = {},
): Promise<{ rows: Notification[]; hasMore: boolean }> {
  let pageSize = options.pageSize ?? 15
  let offset = options.offset ?? 0

  let rows = (
    await queryRows(
      db,
      sql`SELECT id, user_id, type, title, body, appointment_id, read_at, created_at
     FROM notifications
     WHERE user_id = ${userId}
     ORDER BY created_at DESC, id DESC
     LIMIT ${pageSize + 1} OFFSET ${offset}`,
      notificationWireSchema,
    )
  ).map(toNotification)
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()
  return { rows, hasMore }
}

/** Count a user's unread notifications. */
export async function unreadCount(db: Database, userId: number): Promise<number> {
  let rows = await queryRows(
    db,
    sql`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`,
    z.object({ count: int8Aggregate }),
  )
  return rows[0]?.count ?? 0
}

/** Mark a single notification read (scoped to its owner). Returns whether a row changed. */
export async function markRead(
  db: Database,
  userId: number,
  notificationId: number,
): Promise<boolean> {
  let result = await db.exec(
    'UPDATE notifications SET read_at = $1 WHERE id = $2 AND user_id = $3 AND read_at IS NULL',
    [Date.now(), notificationId, userId],
  )
  return (result.affectedRows ?? 0) > 0
}

/** Mark all of a user's unread notifications read. Returns the number updated. */
export async function markAllRead(db: Database, userId: number): Promise<number> {
  let result = await db.exec(
    'UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL',
    [Date.now(), userId],
  )
  return result.affectedRows ?? 0
}

/** Fetch a single notification only if it belongs to the user. */
export async function findNotification(
  db: Database,
  id: number,
  userId: number,
): Promise<Notification | null> {
  let row = await queryRow(
    db,
    sql`SELECT id, user_id, type, title, body, appointment_id, read_at, created_at
     FROM notifications WHERE id = ${id} AND user_id = ${userId}`,
    notificationWireSchema,
  )
  if (!row) return null
  return toNotification(row)
}
