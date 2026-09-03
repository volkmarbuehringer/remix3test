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
   *
   * An optional `key` scopes this subscriber: it only receives broadcasts
   * targeted at the same `key`. Omitting `key` group-subscribes the client
   * to unscoped (global) broadcasts.
   */
  subscribe(request: Request, key?: string): Response

  /**
   * Broadcasts an event to active subscribers.
   *
   * For events with `void` payload (e.g. `{ invalidate: void }`),
   * call without a data argument: `channel.broadcast('invalidate')`.
   *
   * An optional `key` targets only subscribers that subscribed with the same
   * `key`. Omitting `key` (or passing it as `undefined`) broadcasts to all
   * unscoped subscribers (matching the previous global behavior).
   */
  broadcast<E extends keyof EventMap>(
    event: E,
    data?: EventMap[E] extends void ? undefined : EventMap[E],
    key?: string,
  ): void
}

// ── Channel factory ──

export function createChannel<EventMap extends Record<string, unknown>>(
  options?: ChannelOptions,
): Channel<EventMap> {
  let heartbeatMs = options?.heartbeatMs ?? 30_000
  // Scoped subscriber groups. A keyed subscription (e.g. a user id) is stored
  // under its `string` key; an unscoped subscription uses the GLOBAL sentinel.
  // A keyed broadcast reaches only its group; an unscoped broadcast reaches
  // the GLOBAL group, preserving the original broadcast-to-all behavior for
  // channels that never use keys (appointments, admin messages).
  let GLOBAL = Symbol('global') as symbol
  let subscribers = new Map<string | typeof GLOBAL, Set<ReadableStreamDefaultController>>()

  function subscriberGroup(key: string | undefined): string | typeof GLOBAL {
    return key === undefined ? GLOBAL : key
  }

  function removeSubscriber(key: string | undefined, controller: ReadableStreamDefaultController) {
    let group = subscriberGroup(key)
    let set = subscribers.get(group)
    if (!set) return
    set.delete(controller)
    if (set.size === 0) subscribers.delete(group)
  }

  function subscribe(request: Request, key?: string): Response {
    let controller: ReadableStreamDefaultController
    let keepAlive: ReturnType<typeof setInterval> | undefined

    let stream = new ReadableStream({
      start(enqueueController) {
        controller = enqueueController
        let group = subscriberGroup(key)
        let set = subscribers.get(group) ?? new Set()
        set.add(controller)
        subscribers.set(group, set)

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
              removeSubscriber(key, controller)
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
          removeSubscriber(key, controller)
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        })
      },
      cancel() {
        clearInterval(keepAlive)
        removeSubscriber(key, controller)
      },
    })

    let headers = new SuperHeaders()
    headers.contentType = { mediaType: 'text/event-stream' }
    headers.cacheControl = { noCache: true, noStore: true }
    headers.connection = 'keep-alive'
    headers.set('X-Accel-Buffering', 'no')

    return new Response(stream, { headers })
  }

  function broadcast<E extends keyof EventMap>(
    event: E,
    data?: EventMap[E] extends void ? undefined : EventMap[E],
    key?: string,
  ): void {
    let payload = data === undefined ? {} : data
    let encoded = new TextEncoder().encode(
      `event: ${String(event)}\ndata: ${JSON.stringify(payload)}\n\n`,
    )

    let target = key === undefined ? null : subscriberGroup(key)
    let groups: Iterable<Set<ReadableStreamDefaultController>> =
      target === null ? subscribers.values() : subscribers.get(target) ? [subscribers.get(target)!] : []

    // Collect and drop dead subscribers during broadcast to avoid re-entrancy
    for (let set of groups) {
      let dead: ReadableStreamDefaultController[] = []
      for (let subscriber of set) {
        try {
          subscriber.enqueue(encoded)
        } catch {
          dead.push(subscriber)
        }
      }
      for (let subscriber of dead) {
        set.delete(subscriber)
      }
    }
  }

  return { subscribe, broadcast }
}
