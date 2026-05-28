<!-- Context: development/remix3/sse/concepts/channel-factory | Priority: high | Version: 1.0 | Updated: 2026-05-18 -->

# Typed SSE Channel Factory

The `createChannel` factory provides a typed, reusable SSE abstraction that eliminates
boilerplate for real-time push endpoints.

## Core Pattern

Instead of manually managing `Set<ReadableStreamDefaultController>` and creating
`ReadableStream` instances, the factory does it all:

```typescript
const myChannel = createChannel<{
  update: { id: number; data: string }
  invalidate: void
}>()

// In a subscribe handler (returns full SSE Response):
return myChannel.subscribe(request)

// After data changes:
myChannel.broadcast('invalidate')
myChannel.broadcast('update', { id: 1, data: 'new' })
```

## API

| Method | Signature | Purpose |
|--------|-----------|---------|
| `createChannel` | `<EventMap>(options?) => Channel<EventMap>` | Factory — typed by event map |
| `subscribe` | `(request: Request) => Response` | Returns SSE `Response` with headers, stream, heartbeat, cleanup |
| `broadcast` | `(event, data?) => void` | Sends typed event; void payloads omit data arg |

### Options

```typescript
interface ChannelOptions {
  heartbeatMs?: number | null  // Default 30_000. Set 0 or null to disable
}
```

### Typed Event Maps

Event maps use a `Record<string, unknown>` where each key is an event name
and each value is its payload type. Use `void` for events with no payload:

```typescript
type Events = {
  message: { id: number; text: string }
  connected: { sessionId: string }
  invalidate: void   // call: channel.broadcast('invalidate') — no data arg
}
```

## Built-in Behaviors

- **Initial `connected` event** — Every subscriber immediately receives
  `event: connected` with `{ status: 'connected' }`
- **Configurable heartbeat** — SSE comments (`: heartbeat\n\n`) at 30s default to
  prevent proxy timeouts; disable with `heartbeatMs: null`
- **Safe broadcast iteration** — Dead subscribers collected in first pass, deleted
  in separate loop (prevents re-entrancy bugs)
- **Reliable cleanup** — Uses `request.signal.addEventListener('abort')` for
  disconnect detection (more reliable than `ReadableStream.cancel()`)
- **Type safety** — `broadcast('foo', data)` is type-checked: wrong event name or
  payload type is a compile error

## When to Use vs Hand-Rolled

| Scenario | Approach |
|----------|----------|
| Simple invalidation channel | `createChannel<{ invalidate: void }>()` |
| Feature with typed events | `createChannel<{ update: Payload; delete: Id }>()` |
| Room-based broadcasting | Factory per-room, or extend with room Map |
| Custom stream (capped events, per-client filters) | Hand-rolled `ReadableStream` (see `sse-implementation.md`) |

## Codebase References

- **Factory implementation**: `newapp/app/lib/sse.ts` — 153 lines
- **Unit tests**: `newapp/app/lib/sse.test.ts` — 10 tests (subscribe, broadcast, heartbeat,
  cleanup, void events, multiple subscribers, dead subscriber removal)
- **Usage example**: `newapp/app/lib/messages-sse.ts` —
  `adminChannel = createChannel<{ invalidate: void }>()`
- **Controller usage**: `newapp/app/actions/admin-messages-controller.tsx` —
  `adminChannel.subscribe(context.request)`

## Related

- `guides/sse-implementation.md` — Hand-rolled SSE reference (room broadcasting, custom needs)
- `guides/connection-indicator.md` — Client-side connection status component
- `guides/client-side-sse.md` — EventSource client patterns
