<!-- Context: sse/core/concepts/room-broadcasting | Priority: high | Version: 1.2 | Updated: 2026-03-22 -->

# Room Broadcasting

Manage multiple chat rooms with connected clients using a Map-based tracking system.

## Core Idea

Store client connections in a `Map` with their room and username for targeted broadcasts.

## Client Tracking

```typescript
let connectedClients = new Map<
  ReadableStreamDefaultController,
  { room: string; username: string }
>()
```

## Broadcasting Functions

### Broadcast to Room

```typescript
function broadcastToRoom(room: string, event: string, data: object) {
  let encoded = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  connectedClients.forEach((clientInfo, controller) => {
    if (clientInfo.room === room) {
      try {
        controller.enqueue(encoded)
      } catch {
        connectedClients.delete(controller)
      }
    }
  })
}
```

### Broadcast User List

```typescript
function broadcastUserList(room: string) {
  let roomUsers = new Set<string>()
  connectedClients.forEach((clientInfo) => {
    if (clientInfo.room === room) roomUsers.add(clientInfo.username)
  })
  broadcastToRoom(room, 'users', { users: Array.from(roomUsers) })
}
```

## Connection Limits

```typescript
const MAX_CLIENTS_PER_ROOM = 100

function addClient(room: string, controller) {
  let count = Array.from(connectedClients.values()).filter((c) => c.room === room).length
  if (count >= MAX_CLIENTS_PER_ROOM) return false
  connectedClients.set(controller, { room, username })
  return true
}
```

## Related Files

- **SSE Streaming**: `sse/core/concepts/sse-streaming.md`
- **Event Types**: `development/remix3/guides/sse-event-types.md` - Generic SSE event reference
- **Full Implementation**: `development/remix3/guides/sse-implementation.md` - Complete guide

## 📂 Codebase References

**Implementation**: `demos/sse/app/router.tsx` - Room broadcasting
