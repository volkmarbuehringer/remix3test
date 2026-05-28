import { createChannel } from './sse.ts'

/**
 * Typed SSE channel for appointment invalidation.
 *
 * Subscribe: `appointmentChannel.subscribe(request)` — returns a full SSE Response.
 * Broadcast: `appointmentChannel.broadcast('invalidate')` — pushes invalidation to all subscribers.
 */
export const appointmentChannel = createChannel<{ invalidate: void }>()
