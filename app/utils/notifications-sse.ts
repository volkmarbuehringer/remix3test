import { createChannel } from './sse.ts'
import type { NotificationType } from '../data/notifications.ts'

/** Payload pushed to a user's live notification subscription when a new row lands. */
interface NotificationStreamEvent {
  id: number
  type: NotificationType
  title: string
}

/**
 * Per-user SSE channel for in-app booking notifications.
 *
 * Subscribe: the notifications `events` action resolves the current user and
 * calls `notificationsChannel.subscribe(request, String(userId))` — cookies
 * carry identity, so no user id appears in the URL.
 *
 * Broadcast: `broadcastNotification(userId, event)` pushes only to that user's
 * subscription, so private appointment data never leaks to other subscribers.
 *
 * `read` is an invalidation signal: the nav bell survives soft navigations, so
 * marking rows read would otherwise leave its mount-time badge count stale. It
 * refetches the count endpoint on this event instead of trusting a pushed
 * number, which keeps every tab consistent with the database.
 */
export const notificationsChannel = createChannel<{
  new: NotificationStreamEvent
  read: void
}>()

export function broadcastNotification(userId: number, event: NotificationStreamEvent): void {
  notificationsChannel.broadcast('new', event, String(userId))
}

export function broadcastNotificationRead(userId: number): void {
  notificationsChannel.broadcast('read', undefined, String(userId))
}
