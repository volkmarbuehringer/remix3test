/**
 * Generalized SSE (Server-Sent Events) infrastructure.
 *
 * Provides a typed channel factory for creating real-time push endpoints.
 * Any feature can create a channel, subscribe clients via SSE, and
 * broadcast typed events.
 *
 * @example
 * ```ts
 * const chatChannel = createChannel<{
 *   message: { id: number; text: string }
 *   typing: { userId: number }
 * }>()
 *
 * // In a controller action:
 * subscribe(context) {
 *   return chatChannel.subscribe(context.request)
 * }
 *
 * // Elsewhere (after a message is created):
 * chatChannel.broadcast('message', { id: 1, text: 'hello' })
 * ```
 */

import { SuperHeaders } from 'remix/headers'

// ── Types ──

export interface ChannelOptions {
  /**
   * Heartbeat interval in milliseconds.
   * Set to `0` or `null` to disable heartbeats entirely.
   * @default 30_000
   */
  heartbeatMs?: number | null
}

export interface Channel<EventMap extends Record<string, unknown>> {
  /**
   * Creates a complete SSE `Response` for the given request.
   *
   * Handles `ReadableStream` creation, initial `connected` event,
   * heartbeat interval, subscriber registration, and cleanup
   * on client disconnect or abort.
   */
  subscribe(request: Request): Response

  /**
   * Broadcasts an event to all active subscribers.
   *
   * For events with `void` payload (e.g. `{ invalidate: void }`),
   * call without a data argument: `channel.broadcast('invalidate')`.
   */
  broadcast<E extends keyof EventMap>(
    event: E,
    ...[data]: EventMap[E] extends void ? [] : [data: EventMap[E]]
  ): void
}

// ── Channel factory ──

export function createChannel<EventMap extends Record<string, unknown>>(
  options?: ChannelOptions,
): Channel<EventMap> {
  let heartbeatMs = options?.heartbeatMs ?? 30_000
  let subscribers = new Set<ReadableStreamDefaultController>()

  function subscribe(request: Request): Response {
    let controller: ReadableStreamDefaultController
    let keepAlive: ReturnType<typeof setInterval> | undefined

    let stream = new ReadableStream({
      start(enqueueController) {
        controller = enqueueController
        subscribers.add(controller)

        // Send initial connected event so the client knows the stream is live
        try {
          controller.enqueue(
            new TextEncoder().encode(
              `event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`,
            ),
          )
        } catch {
          // Stream may already be closed — nothing to do
        }

        // Start heartbeat to keep the connection alive through proxies
        if (heartbeatMs && heartbeatMs > 0) {
          keepAlive = setInterval(() => {
            try {
              controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`))
            } catch {
              clearInterval(keepAlive)
              subscribers.delete(controller)
              try {
                controller.close()
              } catch {
                /* already closed */
              }
            }
          }, heartbeatMs)
        }

        // Clean up when the client disconnects
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAlive)
          subscribers.delete(controller)
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        })
      },
      cancel() {
        clearInterval(keepAlive)
        subscribers.delete(controller)
      },
    })

    let headers = new SuperHeaders()
    headers.contentType = { mediaType: 'text/event-stream' }
    headers.cacheControl = { noCache: true }
    headers.connection = 'keep-alive'
    headers.set('X-Accel-Buffering', 'no')

    return new Response(stream, { headers })
  }

  function broadcast<E extends keyof EventMap>(
    event: E,
    ...[data]: EventMap[E] extends void ? [] : [data: EventMap[E]]
  ): void {
    let payload = data === undefined ? {} : data
    let encoded = new TextEncoder().encode(
      `event: ${String(event)}\ndata: ${JSON.stringify(payload)}\n\n`,
    )

    // Collect dead subscribers during broadcast to avoid re-entrancy issues
    let dead: ReadableStreamDefaultController[] = []
    for (let subscriber of subscribers) {
      try {
        subscriber.enqueue(encoded)
      } catch {
        dead.push(subscriber)
      }
    }
    for (let subscriber of dead) {
      subscribers.delete(subscriber)
    }
  }

  return { subscribe, broadcast }
}
