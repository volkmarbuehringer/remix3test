<!-- Context: development/remix3/sse | Priority: medium | Version: 1.2 | Updated: 2026-05-18 -->

# Server-Sent Events (SSE)

**Core Idea**: Real-time server-to-client streaming with `ReadableStream`, `EventSource`, and Frame integration.

## Quick Routes

| Task | File |
|------|------|
| Typed channel factory (createChannel) | `concepts/channel-factory.md` |
| Connection status indicator | `guides/connection-indicator.md` |
| SSE server implementation (reference demo) | `guides/sse-server-implementation.md` |
| SSE client-side | `guides/client-side-sse.md` |
| SSE in Frames (multi-client, heartbeat, safe iteration) | `guides/sse-in-frames.md` |
| SSE implementation patterns (room-based, abort, heartbeat) | `guides/sse-implementation.md` |
| SSE event types | `guides/sse-event-types.md` |
| Offline messaging | `guides/sse-offline-messaging.md` |

## Key Patterns (Updated 2026-05-18)

| Pattern | Where Documented |
|---------|-----------------|
| `createChannel` typed factory (preferred for new code) | `concepts/channel-factory.md` |
| SSE connection status indicator | `guides/connection-indicator.md` |
| `request.signal.addEventListener('abort')` for cleanup | `sse-implementation.md`, `sse-in-frames.md` |
| `setInterval` heartbeat (30s) against proxy timeouts | `sse-implementation.md`, `sse-in-frames.md` |
| Safe Set iteration (collect dead, delete in separate loop) | `sse-implementation.md`, `sse-in-frames.md` |
| Event delegation for Frame content (`document` + `closest()`) | `sse-in-frames.md` |
| Multi-client SSE vicious cycle | `project-intelligence/my_app/errors/messages-sse-gotchas.md` |
