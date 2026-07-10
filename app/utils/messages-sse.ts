import { createRateLimiter } from '../utils/rate-limiter.ts'
import { createChannel } from './sse.ts'

/**
 * Typed SSE channel for admin messages.
 *
 * Subscribe: `adminChannel.subscribe(request)` — returns a full SSE Response.
 * Broadcast: `adminChannel.broadcast('invalidate')` — pushes invalidation to all subscribers.
 */
export const adminChannel = createChannel<{ invalidate: void }>()

// Rate limiter for messages (per-user, 500ms window)
export const messageRateLimiter = createRateLimiter({ windowMs: 500, perUser: true })

export function broadcastInvalidate(): void {
  adminChannel.broadcast('invalidate')
}
