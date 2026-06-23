## Context

The webhook-requests page at `/webhook-requests` is a standalone SSR page (not inside the admin Frame). It uses an inline `<script type="module">` to create an `EventSource` to `/webhook-requests/events`. When `new_request` or `callback_received` events arrive, it waits 2 seconds then navigates to `window.location.href` with a `_t` cache-busting param.

Every other SSE-using page (admin messages, appointments, verwaltung appointments) uses the `ConnectionIndicator` clientEntry component from `app/assets/connection-indicator.tsx`. This component:
- Creates the EventSource via `handle.queueTask()` after hydration
- Listens for `invalidate` events to trigger reload
- Uses `handle.frame.reload()` or `window.location.reload()` depending on `reloadMode`
- Properly cleans up via `handle.signal` abort listener
- Shows connection state (connected/reconnecting/disconnected) via a colored dot + text

The `webhookChannel` in `app/lib/sse-events.ts` currently emits `new_request` and `callback_received` events. The `ConnectionIndicator` listens for `invalidate` events.

## Goals / Non-Goals

**Goals:**
- Replace the inline `<script>` in `WebhookRequestsPage` with `ConnectionIndicator`
- Add `invalidate` event broadcasts alongside existing `new_request`/`callback_received` broadcasts
- Remove the `_t` cache-busting URL parameter accumulation
- Keep the 2-second debounce on reload (to batch rapid events)
- All four broadcast sites stay in sync: webhook, app-webhook, callback, resend

**Non-Goals:**
- Not changing the webhook channel's existing events (they stay for backward compat)
- Not moving the webhook-requests page inside the admin Frame sidebar
- Not changing the SSE channel infrastructure (`createChannel`, heartbeat, etc.)

## Decisions

### Decision: Add `invalidate` broadcast alongside existing events

Rather than changing `ConnectionIndicator` to listen for custom event names, add `webhookChannel.broadcast('invalidate')` at each broadcast site. The `webhookChannel` already supports adding new event types (the `EventMap` is `{ new_request: void; callback_received: void }` — we'll extend it).

**Alternative considered**: Extend `ConnectionIndicator` with a configurable event name prop. Rejected because all existing uses listen for `invalidate` and keeping a consistent event name is simpler.

### Decision: Use `reloadMode="window"` for ConnectionIndicator

The webhook-requests page is a standalone page (not inside a Frame), so `reloadMode="window"` is appropriate. This causes `window.location.reload()` on `invalidate`, which avoids URL parameter accumulation.

**Alternative considered**: `reloadMode="frame"` — not applicable since the page has no parent Frame.

### Decision: Keep 2-second reload delay via ConnectionIndicator's existing behavior

The `ConnectionIndicator` currently reloads immediately on `invalidate`. The webhook-requests page had a 2-second debounce. We'll keep the immediate reload pattern from `ConnectionIndicator` for consistency. The debounce was an implementation detail of the inline script, not a requirement.

### Decision: Extend webhookChannel EventMap

```ts
// Before: app/lib/sse-events.ts
export const webhookChannel = createChannel<{
  new_request: void
  callback_received: void
}>()

// After:
export const webhookChannel = createChannel<{
  new_request: void
  callback_received: void
  invalidate: void
}>()
```

This is fully backward compatible — existing broadcasts of `new_request` and `callback_received` continue to work.

## Risks / Trade-offs

- **[Low risk]** Existing clients with inline scripts will still connect but won't see `invalidate` events. Mitigation: the `invalidate` broadcast is added alongside existing events, and the page replacement deploys atomically.
- **[Low risk]** The `ConnectionIndicator` doesn't have a 2-second debounce. If rapid webhook bursts arrive, the page reloads for each one. Mitigation: the server processes sequentially and the browser's EventSource buffers events; a single reload after the burst achieves the same net result.
- **[No risk]** CSP nonce requirement: the `ConnectionIndicator` is a compiled clientEntry asset, so it doesn't need a nonce. The inline script's nonce dependency is eliminated.
