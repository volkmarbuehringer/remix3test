import type { NotificationData } from './sender.ts'

interface FailedNotification {
  id: string
  recipient: string
  type: NotificationData['type']
  data: NotificationData
  failedAt: number
  retryCount: number
}

const queue: FailedNotification[] = []

export function enqueueFailedNotification(
  recipient: string,
  type: NotificationData['type'],
  data: NotificationData,
): void {
  queue.push({
    id: crypto.randomUUID(),
    recipient,
    type,
    data,
    failedAt: Date.now(),
    retryCount: 0,
  })
}

export function getFailedNotifications(): FailedNotification[] {
  return [...queue]
}

export function clearFailedNotifications(): void {
  queue.length = 0
}
