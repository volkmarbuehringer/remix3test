import { type Database } from 'remix/data-table'

import { notifications, type Notification } from './schema.ts'

const NOTIFICATION_TYPES = ['confirmation', 'reminder', 'cancellation'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface CreateNotificationInput {
  userId: number
  type: NotificationType
  title?: string
  body?: string
  appointmentId?: number
}

/** Persist a notification row for a user. Returns the created row. */
export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
): Promise<Notification | null> {
  let result = await db.exec(
    `INSERT INTO notifications (user_id, type, title, body, appointment_id, read_at, created_at)
     VALUES ($1, $2, $3, $4, $5, NULL, $6)
     RETURNING id`,
    [
      input.userId,
      input.type,
      input.title ?? '',
      input.body ?? '',
      input.appointmentId ?? null,
      Date.now(),
    ],
  )
  let row = result.rows?.[0] as { id: number } | undefined
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

  let result = await db.exec(
    `SELECT id, user_id, type, title, body, appointment_id, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [userId, pageSize + 1, offset],
  )
  let rows = (result.rows ?? []) as unknown as Notification[]
  for (let row of rows) {
    row.user_id = Number(row.user_id)
    row.appointment_id = row.appointment_id == null ? null : Number(row.appointment_id)
    row.read_at = row.read_at == null ? null : Number(row.read_at)
    row.created_at = Number(row.created_at)
  }
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()
  return { rows, hasMore }
}

/** Count a user's unread notifications. */
export async function unreadCount(db: Database, userId: number): Promise<number> {
  let result = await db.exec(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  )
  return Number(result.rows?.[0]?.count ?? 0)
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
  let result = await db.exec(
    `SELECT id, user_id, type, title, body, appointment_id, read_at, created_at
     FROM notifications WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  let row = result.rows?.[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    type: String(row.type),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    appointment_id: row.appointment_id == null ? null : Number(row.appointment_id),
    read_at: row.read_at == null ? null : Number(row.read_at),
    created_at: Number(row.created_at),
  }
}
