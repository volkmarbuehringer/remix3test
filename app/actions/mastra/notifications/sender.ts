import { db } from '../../../db.ts'
import { createNotification, type NotificationType } from '../../../data/notifications.ts'
import { broadcastNotification } from '../../../utils/notifications-sse.ts'

export interface NotificationData {
  recipient: string
  type: 'confirmation' | 'reminder' | 'cancellation'
  appointmentId?: number
  resourceName?: string
  date?: number
  timeRange?: string
  customerName?: string
  title?: string
}

export interface NotificationResult {
  sent: boolean
  provider: string
  error?: string
}

export interface NotificationSender {
  send(
    recipient: string,
    type: NotificationData['type'],
    data: NotificationData,
  ): Promise<NotificationResult>
}

/**
 * Legacy stub that only logged notifications. Kept exported so existing tests
 * and tooling still import it, but the production booking workflows now send
 * through `dbNotificationSender`.
 */
export const consoleNotificationSender: NotificationSender = {
  async send(recipient, type, data) {
    console.log(
      '[Notification]',
      JSON.stringify({
        recipient,
        type,
        appointmentId: data.appointmentId,
        resourceName: data.resourceName,
        date: data.date,
        timeRange: data.timeRange,
        customerName: data.customerName,
        title: data.title,
        timestamp: new Date().toISOString(),
      }),
    )
    return { sent: true, provider: 'console' }
  },
}

function notificationTitle(type: NotificationData['type'], data: NotificationData): string {
  if (data.title) return data.title
  switch (type) {
    case 'confirmation':
      return 'Termin bestätigt'
    case 'reminder':
      return 'Terminerinnerung'
    case 'cancellation':
      return 'Termin storniert'
  }
}

function formatNotificationDate(ms: number): string {
  let d = new Date(ms)
  let dd = String(d.getUTCDate()).padStart(2, '0')
  let mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getUTCFullYear()}`
}

function notificationBody(type: NotificationData['type'], data: NotificationData): string {
  let parts: string[] = []
  if (data.date) parts.push(formatNotificationDate(data.date))
  if (data.resourceName) parts.push(data.resourceName)
  if (data.timeRange) parts.push(data.timeRange)
  let detail = parts.join(' · ')
  if (!detail) return notificationTitle(type, data)
  switch (type) {
    case 'confirmation':
      return `Termin bestätigt: ${detail}`
    case 'reminder':
      return `Erinnerung: ${detail}`
    case 'cancellation':
      return `Termin storniert: ${detail}`
  }
}

/**
 * In-app notification sender: persists one notification row for the user and
 * pushes a per-user SSE `new` event so the bell badge and inbox update live.
 * Throws on delivery failure (the workflow caller falls back to the retry
 * queue), and never affects the booking outcome.
 */
export const dbNotificationSender: NotificationSender = {
  async send(recipient, type, data) {
    let userId = Number.parseInt(recipient, 10)
    if (Number.isNaN(userId) || userId <= 0) {
      throw new Error(`Invalid notification recipient: ${recipient}`)
    }

    let title = notificationTitle(type, data)
    let body = notificationBody(type, data)

    let row = await createNotification(db, {
      userId,
      type: type as NotificationType,
      title,
      body,
      appointmentId: data.appointmentId,
    })
    if (row == null) {
      return { sent: false, provider: 'db', error: 'createNotification returned no row' }
    }

    broadcastNotification(userId, { id: row.id, type: type as NotificationType, title })
    return { sent: true, provider: 'db' }
  },
}
