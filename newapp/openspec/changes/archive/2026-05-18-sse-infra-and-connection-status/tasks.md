## 1. SSE Channel Infrastructure

- [x] 1.1 Create `app/lib/sse.ts` with typed `createChannel<EventMap>()` factory including subscriber management, heartbeat, broadcast, and lifecycle cleanup
- [x] 1.2 Implement `Channel.subscribe(request)` method that creates a complete SSE `Response` with `ReadableStream`, proper headers (`Content-Type`, `Cache-Control`, `Connection`, `X-Accel-Buffering`), initial `connected` event, and abort signal cleanup
- [x] 1.3 Add `Channel.broadcast(event, payload)` with typed event names, SSE formatting, and dead subscriber removal on broadcast errors
- [x] 1.4 Support configurable heartbeat interval via `ChannelOptions` (default 30s, disable with `0` or `null`)
- [x] 1.5 Export `createChannel`, `Channel`, `ChannelOptions` types from `app/lib/sse.ts`

## 2. Channel Unit Tests

- [x] 2.1 Write `app/lib/sse.test.ts` — test channel creation, typed broadcast, subscribe response headers and content type
- [x] 2.2 Test heartbeat lifecycle — verify heartbeat interval starts on subscribe and stops on disconnect
- [x] 2.3 Test subscriber cleanup — verify subscribers are removed on abort, cancel, and broadcast error
- [x] 2.4 Test initial `connected` event and SSE event formatting

## 3. Connection Status Indicator

- [x] 3.1 Create `app/assets/connection-indicator.tsx` with `clientEntry` rendering a pulsing dot and status text for connected/disconnected/reconnecting states
- [x] 3.2 Implement `EventSource` lifecycle — connect on mount, listen for `open`/`error`/`connected` events, update state accordingly, close on abort
- [x] 3.3 Support configurable `url` prop for the subscription endpoint
- [x] 3.4 Style three states: green pulsing dot + "Connected", red static dot + "Disconnected", amber dot + "Reconnecting..."

## 4. Admin Messages Migration

- [x] 4.1 Update `app/actions/admin-messages-controller.tsx` — replace inline `ReadableStream` subscribe logic with `adminChannel.subscribe(request)` using the new infrastructure
- [x] 4.2 Create an `adminChannel` instance in `app/lib/messages-sse.ts` (or alongside it) with event types `{invalidate: void}` — update `broadcastInvalidate()` to use the channel
- [x] 4.3 Mark the old `sseClients` Set as deprecated with a comment directing to the new channel pattern
- [x] 4.4 Update `app/ui/admin-messages-page.tsx` — add `ConnectionIndicator` near the page header showing connection status for `/admin/messages/subscribe`

## 5. Admin Messages Controller Tests

- [x] 5.1 Update existing `app/actions/admin-messages-controller.test.ts` — verify the subscribe endpoint still returns correct SSE headers and status codes after migration
- [x] 5.2 Verify that POST/DELETE actions still trigger invalidation through the new channel
