<!-- Context: development/remix3/guides/sse-implementation | Priority: high | Version: 1.6 | Updated: 2026-05-18 -->

# SSE Implementation Guide

Step-by-step guide to Server-Sent Events in Remix 3 with room-based broadcasting.

> **Prefer the typed channel factory for new code.** The `createChannel` pattern in
> `concepts/channel-factory.md` wraps all the boilerplate below (Set management,
> ReadableStream creation, heartbeat, abort cleanup, safe broadcast) into a reusable
> factory. Use this hand-rolled guide only when you need custom streaming behavior
> (capped events, per-client filters, room routing).

## Overview

```
Client (EventSource) → HTTP GET /messages?room=general&username=alice → Server (ReadableStream)
  → store controller + broadcast to room → All clients in room receive events
```

## Core Components

| Component | Purpose |
|-----------|---------|
| `connectedClients` Map | Track `ReadableStreamDefaultController` → `{ room, username }` |
| `ReadableStream` | SSE stream per client |
| `broadcastToRoom()` | Send events to all clients in a room |
| `broadcastUserList()` | Sync user list on join/leave |

## Step 1: Client Tracking

```typescript
let connectedClients = new Map<ReadableStreamDefaultController, { room: string; username: string }>()
```

## Step 2: Create SSE Route

```typescript
router.map({
  messages(context) {
    let stream = new ReadableStream({
      start(controller) {
        connectedClients.set(controller, { room, username })
        controller.enqueue(new TextEncoder().encode(`event: users\ndata: ${JSON.stringify({ users: getRoomUsers(room) })}\n\n`))
        broadcastUserList(room)
      },
      cancel() { connectedClients.delete(controller); broadcastUserList(room) },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
    })
  },
})
```

## Step 3: Broadcast to Room

```typescript
function broadcastToRoom(room: string, event: string, data: object) {
  let encoded = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  let dead: ReadableStreamDefaultController[] = []
  for (let [controller, clientInfo] of connectedClients) {
    if (clientInfo.room === room) {
      try { controller.enqueue(encoded) } catch { dead.push(controller) }
    }
  }
  for (let controller of dead) { connectedClients.delete(controller) }  // Separate pass — never delete during iteration
}
```

## Step 4: Cleanup on Disconnect

```typescript
context.request.signal.addEventListener('abort', () => {
  let clientInfo = connectedClients.get(controller)
  if (clientInfo) { connectedClients.delete(controller); broadcastUserList(clientInfo.room) }
})
```

**Why `request.signal`**: `ReadableStream.cancel()` is not reliably called on abrupt disconnect (tab close, network failure). `request.signal` fires when HTTP connection drops — guaranteed by the fetch lifecycle.

## Step 5: Heartbeat (Prevent Proxy Timeouts)

Proxy servers close idle connections after 30-60s. Use SSE comments (`: comment\n\n`) as keepalive:

```typescript
start(controller) {
  let keepAlive = setInterval(() => {
    try { controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`)) }
    catch { clearInterval(keepAlive); connectedClients.delete(controller) }
  }, 30_000)
  request.signal.addEventListener('abort', () => { clearInterval(keepAlive) })
},
cancel() { clearInterval(keepAlive) }
```

## Input Sanitization

```typescript
function sanitizeRoom(room: string | null): string {
  return (room ?? 'default').slice(0, 50).replace(/[^\w-]/g, '') || 'default'
}
function sanitizeUsername(username: string | null): string {
  return (username ?? 'anonymous').slice(0, 30).replace(/[^\w]/g, '') || 'anonymous'
}
```

## Rate Limiting

See `guides/rate-limiting.md`. Apply per user per room:
```typescript
if (!checkRateLimit(`${username}:${room}`, 500)) { return redirect(context.url.pathname) }
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Events not firing | Check `Content-Type: text/event-stream` |
| nginx buffering | Add `X-Accel-Buffering: no` |
| Memory leaks | Use AbortSignal cleanup + heartbeat + safe Set iteration |
| Connection drops after 30-60s idle | Periodic `: heartbeat\n\n` via setInterval |
| `cancel()` not firing on disconnect | Use `request.signal.addEventListener('abort', ...)` as primary cleanup |
| Deleting from Map during iteration | Collect dead items first, delete in separate loop |

## Related

- `sse-event-types.md` — Event type reference
- `guides/rate-limiting.md` — Rate limiting patterns
