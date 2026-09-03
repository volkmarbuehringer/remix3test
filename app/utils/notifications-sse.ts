import { createChannel } from './sse.ts'
import type { NotificationType } from '../data/notifications.ts'

/** Payload pushed to a user's live notification subscription when a new row lands. */
export interface NotificationStreamEvent {
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
 */
export const notificationsChannel = createChannel<{ new: NotificationStreamEvent }>()

export function broadcastNotification(userId: number, event: NotificationStreamEvent): void {
  notificationsChannel.broadcast('new', event, String(userId))
}
