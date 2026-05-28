<!-- Context: bookstore-demo/guides/messages-sse-streaming | Priority: critical | Version: 1.0 | Updated: 2026-04-30 -->

# Messages SSE Streaming Guide

**Purpose**: How the messages feature implements real-time updates via SSE, including the critical `sendResponse` double-read workaround.

---

## Architecture

```
messages-sse.ts (shared module)
├── sseClients: Set<ReadableStreamDefaultController>  ← module-level state
├── lastMessageTime: Map<number, number>              ← per-user rate limit
├── RATE_LIMIT_MS = 500
├── broadcastMessage(data)                            ← iterate + enqueue to all
└── setInterval cleanup (every 50s)                   ← stale rate limit entries

router.ts (SSE endpoint, NOT controller)
└── router.map({ messagesSubscribe: routes.messagesSubscribe }, {
      middleware: [requireAuth()],
      actions: {
        messagesSubscribe() {
          ReadableStream → sseClients.add(controller) → return Response(stream)
        }
      }
    })
```

## Why SSE in router.ts (NOT controller.tsx)?

The controller's `actions.index` / `actions.action` pattern returns `Response` or `render()` output. A streaming SSE endpoint needs to:
1. Hold the connection open indefinitely
2. Return a `ReadableStream` wrapped in `Response`
3. Apply `requireAuth()` without controller middleware

The router's `router.map()` with inline actions and explicit middleware array gives full control. This is the established Remix 3 pattern for SSE.

## Critical: sendResponse Double-Read Workaround

**Bug**: `sendResponse` in `@remix-run/node-fetch-server` reads **two chunks** from the stream before writing the first one. If only one chunk is enqueued immediately, the first `enqueue()` call in `broadcastMessage()` hangs.

**Fix**: Enqueue **two chunks** in `start()`:

```typescript
start(controller) {
  sseClients.add(controller)
  
  // Chunk 1: Connected event
  controller.enqueue(
    new TextEncoder().encode(
      `event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`
    )
  )
  // Chunk 2: Heartbeat comment (gets past sendResponse's double-read)
  controller.enqueue(
    new TextEncoder().encode(`: heartbeat\n\n`)
  )
}
```

**Always enqueue 2+ chunks in `start()`** for any SSE stream. The first enqueue is the real event, the second is a comment-line heartbeat that `sendResponse` consumes without affecting clients.

## Client-Side SSE (page.tsx)

### Form Interception (Critical)

The `<form method="POST" action="/messages">` must be intercepted with `fetch()` to prevent full-page navigation:

```javascript
form.addEventListener('submit', function(e) {
  e.preventDefault()
  fetch(form.action, { method: 'POST', body: new FormData(form), redirect: 'manual' })
  form.querySelector('textarea').value = ''
})
```

Without this, the browser navigates away from the page, closing the EventSource connection. The user would lose real-time updates until the SSR page reloads.

### EventSource Setup

```javascript
// Delay creation slightly to let page navigation settle
window.addEventListener('load', function() {
  setTimeout(function() {
    var eventSource = new EventSource('/messages/subscribe')

    eventSource.addEventListener('message', function(event) {
      var data = JSON.parse(event.data)
      // Build DOM element and prepend to container
      container.prepend(item)
      container.scrollTop = 0
    })
    // No error handler needed — EventSource auto-reconnects silently
  }, 500)
})
```

### SSE Message Format

```
event: connected
data: {"status":"connected"}

event: message
data: {"id":1,"sender_id":2,"sender_name":"Admin","content":"Hello!","created_at":1746000000000}

: heartbeat

```

## SSE Cleanup

| Scenario | Mechanism |
|----------|-----------|
| Client disconnects | `cancel()` on `ReadableStream` → `sseClients.delete(controller)` |
| Broadcast to stale client | `controller.enqueue()` throws → caught, `sseClients.delete(controller)` |
| Client closes tab | Browser closes connection → `cancel()` fires |
| Server shutdown | Connection drops, clients auto-reconnect on next EventSource retry |

## SSE Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Type` | `text/event-stream` | Required for SSE |
| `Cache-Control` | `no-cache` | Prevent caching |
| `Connection` | `keep-alive` | Keep connection open |
| `X-Accel-Buffering` | `no` | Prevent nginx buffering |

## Codebase References

| File | Lines | What |
|------|-------|------|
| `bookstore/app/lib/messages-sse.ts` | Full file (32 lines) | SSE store, broadcast, rate limiting |
| `bookstore/app/router.ts` | 107-142 | SSE endpoint with double-read workaround |
| `bookstore/app/controllers/messages/page.tsx` | 179-252 | Client-side EventSource + form intercept |
| `bookstore/app/controllers/messages/controller.tsx` | 94-102 | broadcastMessage() call after DB insert |

## Related

- `concepts/messages-architecture.md` — Overall architecture
- `errors/messages-implementation-gotchas.md` — Known issues
- `../../development/remix3/guides/sse-implementation.md` — Generic Remix SSE
- `../../project-intelligence/sse/guides/testing-sse.md` — SSE testing patterns
