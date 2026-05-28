<!-- Context: sse/decisions/ADR-002-sse-protocol | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# ADR-002: SSE Event Streaming Protocol

**Status**: accepted  
**Date**: 2026-03-22  
**Context**: demos/sse | **Module**: router.tsx, message-stream.tsx  
**Related Tasks**: N/A  
**Related ADRs**: ADR-001

---

## Context

The SSE demo needs to push real-time messages from server to connected clients.

**Problem**: How should the server communicate real-time updates to clients?

## Decision

Use Server-Sent Events (SSE) with ReadableStream, implementing the `text/event-stream` protocol standard:

- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Event format: `event: <type>\ndata: <json>\n\n`
- Uses `ReadableStreamDefaultController` for streaming
- Heartbeat status events every 60 seconds (configurable via `?interval` query param)

```typescript
let stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(`event: status\n`))
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ timestamp })}\n\n`))
  },
})
```

## Alternatives Considered

### Option 1: WebSockets

- **Pros**: Bidirectional communication, faster for high-frequency updates, no reconnection logic needed
- **Cons**: More complex protocol, requires different client code, heavier server-side resource usage
- **Why rejected**: Unidirectional (server→client) is sufficient for this use case; SSE is simpler with native browser support

### Option 2: Long Polling

- **Pros**: Works everywhere, simple HTTP semantics
- **Cons**: Higher latency, more HTTP overhead, no true real-time push
- **Why rejected**: SSE provides more efficient real-time push with less overhead

### Option 3: HTTP/2 Server Push

- **Pros**: Protocol-level push, works with existing HTTP/2
- **Cons**: Limited browser support, requires HTTP/2, more complex server setup
- **Why rejected**: Not universally supported, added complexity without clear benefit for demo

### Option 4: GraphQL Subscriptions

- **Pros**: Type-safe subscriptions, integrates with GraphQL ecosystem
- **Cons**: Additional infrastructure (Apollo, Mercury, etc.), significant complexity for a demo
- **Why rejected**: Overkill for simple real-time messaging use case

## Consequences

### Positive

- Native browser `EventSource` API — no library needed
- Automatic reconnection on disconnect
- Simple text-based protocol, easy to debug
- Works over HTTP/1.1
- Single connection per client (efficient)

### Negative

- Unidirectional only (server→client); client→server requires separate HTTP requests
- Maximum 6 connections per domain in older browsers (modern browsers improved this)
- No binary data support (must encode as base64/text)

### Neutral

- Appropriate for chat, notifications, live updates
- Not suitable for gaming or high-frequency bidirectional data

---

## Implementation Notes

- Events sent: `status` (heartbeat), `users` (user list updates), `broadcast` (messages), `direct` (private messages), `error` (connection errors), `shutdown` (server shutdown)
