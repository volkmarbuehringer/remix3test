<!-- Context: development/remix3/guides/sse-event-types | Priority: medium | Version: 1.1 | Updated: 2026-03-24 -->

# SSE Event Types

Reference for all SSE event types used in Remix 3 applications.

## Event Format
```
event: <event-name>
data: <json-payload>

```

## Standard Events

### `users` - User List Update
Broadcast when users join or leave a room.
```typescript
controller.enqueue(new TextEncoder().encode(`event: users\ndata: ${JSON.stringify({ users: ['alice', 'bob'] })}\n\n`))
eventSource.addEventListener('users', (e) => { let { users } = JSON.parse(e.data); renderUserList(users) })
```
**Payload**: `{ users: string[] }`

### `status` - Status Message
Periodic heartbeat or activity notifications.
```typescript
controller.enqueue(new TextEncoder().encode(`event: status\ndata: ${JSON.stringify({ timestamp: new Date().toLocaleTimeString() })}\n\n`))
```
**Payload**: `{ timestamp: string }`

### `broadcast` - Room Broadcast
Message sent to all users in a room.
```typescript
controller.enqueue(new TextEncoder().encode(`event: broadcast\ndata: ${JSON.stringify({ from: 'alice', message: 'Hello!' })}\n\n`))
```
**Payload**: `{ from: string, to: string, message: string, timestamp?: string, encrypted?: boolean }`

### `offline` - Offline Message Delivery
Messages stored for offline users, delivered on reconnect.
```typescript
controller.enqueue(new TextEncoder().encode(`event: offline\ndata: ${JSON.stringify({ from: 'alice', message: 'Hello!', encrypted: false, msgId: '123', isOfflineMessage: true })}\n\n`))
```
**Payload**: `{ from: string, message: string, encrypted: boolean, msgId: string, isOfflineMessage: boolean }`

### `direct` - Direct Message
Private message to a specific user.
```typescript
targetController.enqueue(new TextEncoder().encode(`event: direct\ndata: ${JSON.stringify({ from: 'alice', message: 'Private' })}\n\n`))
```
**Payload**: `{ from: string, message: string }`

### `error` - Error Notification
Error messages (e.g., duplicate login, rate limit).
```typescript
controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({ error: 'User already logged in' })}\n\n`)); controller.close()
```
**Payload**: `{ error: string }`

### `shutdown` - Server Shutdown
Server is shutting down gracefully.
```typescript
controller.enqueue(new TextEncoder().encode(`event: shutdown\ndata: ${JSON.stringify({ reason: 'server_shutdown' })}\n\n`))
```
**Payload**: `{ reason: string }`

## Default `message` Event
Generic event without explicit `event:` field:
```typescript
controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ msg: 'hello' })}\n\n`))
eventSource.onmessage = (e) => { console.log('Received:', e.data) }
```

## Event Priority
| Event | Frequency | Audience |
|-------|-----------|----------|
| `users` | On join/leave | All in room |
| `status` | Periodic | All in room |
| `broadcast` | User messages | All in room |
| `direct` | User whispers | Single user |
| `error` | On error | Single user |
| `shutdown` | On shutdown | All clients |

## Client-Side Handling
```typescript
let eventSource = new EventSource('/messages')
eventSource.addEventListener('users', (e) => { let { users } = JSON.parse(e.data) })
eventSource.addEventListener('error', (e) => { /* Check login status via separate endpoint */ })
eventSource.onopen = () => console.log('Connected')
eventSource.onerror = () => console.error('Connection error')
```

## Related
- `./sse-implementation.md` - Full implementation guide
- `./client-side-sse.md` - EventSource client usage
