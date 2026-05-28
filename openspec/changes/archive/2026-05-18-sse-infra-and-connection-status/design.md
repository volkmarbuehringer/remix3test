## Context

**Current state:** Newapp has exactly one SSE feature — the admin messages page. Its infrastructure lives in `app/lib/messages-sse.ts` which exports a bare `Set<ReadableStreamDefaultController>` and a `broadcastInvalidate()` function. The subscription endpoint (`/admin/messages/subscribe`) duplicates the full `ReadableStream` boilerplate: manual header setup, heartbeat timer, abort listener, and cleanup. Any new feature wanting SSE (chat token streaming, agent step progress, workflow status) would copy this same pattern, creating scattered `Set` instances with inconsistent error handling.

**Constraints:**
- Must work with Remix 3's `fetch-router` pattern (no React, no Express)
- SSE endpoints are controller actions returning `Response` with a `ReadableStream` body
- Client-side interactivity uses `clientEntry` assets, not React components
- Existing admin messages SSE has tests at `app/actions/admin-messages-controller.test.ts`
- No new external dependencies — only the Remix runtime and Web APIs

## Goals / Non-Goals

**Goals:**
- Provide a typed, reusable `createChannel<EventMap>()` factory that manages SSE subscriber sets, typed event broadcast, and lifecycle cleanup
- Provide a `createSubscriptionEndpoint()` helper that produces a standards-compliant SSE `Response` reusing a channel — eliminating boilerplate from controller actions
- Create a reusable `ConnectionIndicator` client asset showing connected/disconnected/reconnecting states
- Migrate the admin messages page to use the new infrastructure
- Cover the channel system with unit tests

**Non-Goals:**
- Chat token streaming or agent step streaming (those are separate features that will use this infrastructure)
- Automatic reconnection with last-event-ID recovery (future enhancement)
- Multiplexing multiple event types over a single connection (each channel = one connection)
- Server-side event retention or replay (SSE as real-time only, not message history)

## Decisions

### Decision 1: Channel factory over class-based manager

**Chosen:** A `createChannel<EventMap>()` factory function returning a lightweight channel object.

Contrasted with:
- **Class-based manager** (`class SSEManager { createChannel() {} }`) — more ceremony, no real benefit since channels are independent singletons
- **Global registry** with string keys — loses type safety for event payloads across modules

The factory captures an `EventMap` generic so every channel has typed `broadcast(event, payload)` and every subscriber receives typed event data. Each channel owns its subscriber `Set` internally — no shared mutable state.

```ts
// Usage:
const adminChannel = createChannel<{
  invalidate: void
  message: { id: number; content: string; sender_name: string }
}>()

// Subscribe (in controller):
adminChannel.subscribe(request, (event, data) => {
  controller.enqueue(formatSSE(event, data))
})

// Broadcast (anywhere):
adminChannel.broadcast('invalidate')
```

### Decision 2: `subscribe()` returns a Response directly

**Chosen:** The `Channel.subscribe(request)` method creates the full SSE `Response` — handles `ReadableStream` creation, heartbeat interval, abort signal listener, subscriber registration/cleanup, and all required headers (`Content-Type`, `Cache-Control`, `Connection`, `X-Accel-Buffering`).

Compared to having controllers assemble the response manually from channel primitives. The helper eliminates the ~20 lines of boilerplate that every SSE endpoint currently duplicates. Controllers only need:

```ts
subscribe(context) {
  return adminChannel.subscribe(context.request)
}
```

The method also sends an initial `event: connected` with status, so client `EventSource.onopen` fires immediately and the connection indicator can show "Connected".

### Decision 3: Heartbeat as configurable channel option

Heartbeat is critical for SSE connections behind proxies that timeout idle connections. Made it a configurable channel option (default 30s) passed via `createChannel({ heartbeatMs: 30000 })`. Pass `0` or `null` to disable. The SSE demo at `~/remix/demos/sse` shows SSE works without heartbeat locally, but behind nginx/caddy it's essential.

### Decision 4: Connection indicator as `clientEntry` rendered inline

The connection indicator uses `clientEntry` / `EventSource` — no `window.EventSource` polyfill needed. The component receives a subscription URL, creates an `EventSource`, listens for `open`, `error`, and a custom `connected` event, and renders a pulsing dot + status text.

We mount it in two ways:
- **As a page element**: Added to a specific page template (like admin messages page) near the content area
- **As a persistent element**: Could be added to the global layout for site-wide SSE features

The component cleans up on abort via `handle.signal`.

### Decision 5: Migration path — deprecate, not rewrite

Rather than refactoring `messages-sse.ts` immediately, we create the new infrastructure alongside it, then update the admin messages controller to use the new channel. The old module stays but is marked deprecated. This keeps the change focused and reversible.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Channel holds references to disconnected clients (memory leak) | Every `subscribe()` call attaches to `request.signal`'s `abort` event and a `cancel()` handler on the `ReadableStream` — both remove the subscriber. Heartbeat failures also trigger cleanup. |
| Heartbeat interferes with compression middleware | Compression middleware operates on response bytes; the 30-second `: heartbeat` comment is small enough (< 10 bytes) that it won't cause frame-flushing issues. The SSE demo confirms compression and SSE work together. |
| `FormData`/`methodOverride` middleware interferes with GET subscription endpoints | The subscribe route is a `get('/subscribe')` route, so no form data parsing or method override runs. The route is registered before those middlewares in the controller. |
| Multiple simultaneous subscribers cause broadcast ordering issues | Each `ReadableStreamDefaultController.enqueue()` is synchronous — no ordering concern. The `for...of` loop does sequential broadcast per subscriber. |
