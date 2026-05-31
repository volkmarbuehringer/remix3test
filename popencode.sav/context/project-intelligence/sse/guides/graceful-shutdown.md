<!-- Context: sse/guides/graceful-shutdown | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Graceful Shutdown

Properly close SSE connections when the server shuts down.

## The Problem

Abruptly killing a server leaves SSE clients in a broken state. Graceful shutdown:

1. Notifies clients of impending shutdown
2. Gives clients time to receive the notification
3. Closes connections cleanly
4. Exits the process

## Implementation

### Step 1: Export Shutdown Notification

```typescript
// app/router.tsx
export function notifySSEClientsOfShutdown() {
  connectedClients.forEach((clientInfo, controller) => {
    try {
      controller.enqueue(
        new TextEncoder().encode(
          `event: shutdown\ndata: ${JSON.stringify({ reason: 'server_shutdown' })}\n\n`,
        ),
      )
    } catch {
      // Client may already be disconnected
    }
  })
}
```

### Step 2: Create Server with Shutdown Handler

```typescript
// server.ts
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { router, notifySSEClientsOfShutdown } from './app/router.tsx'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)
```

### Step 3: Handle SIGINT/SIGTERM

```typescript
let shuttingDown = false

function shutdown() {
  if (shuttingDown) return // Prevent double shutdown
  shuttingDown = true

  console.log('[SHUTDOWN] Notifying SSE clients...')
  notifySSEClientsOfShutdown()

  // Give clients time to receive the shutdown event
  setTimeout(() => {
    server.close(() => process.exit(0))
    server.closeAllConnections()
  }, 1000) // 1 second grace period
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

## Client-Side Handling

```typescript
let eventSource = new EventSource('/messages')

eventSource.addEventListener('shutdown', (e) => {
  let { reason } = JSON.parse(e.data)
  console.log('Server shutting down:', reason)
  // Clean up and show message to user
})

eventSource.addEventListener('error', () => {
  // Check if disconnected due to shutdown
})
```

## Shutdown Event Format

```typescript
event: shutdown
data: {"reason":"server_shutdown"}

```

## Key Points

| Aspect                | Implementation                        |
| --------------------- | ------------------------------------- |
| Signal handling       | SIGINT (Ctrl+C) and SIGTERM (kill)    |
| Double-shutdown guard | `shuttingDown` flag                   |
| Grace period          | 1 second for clients to receive event |
| Force close           | `server.closeAllConnections()`        |
| Clean exit            | `process.exit(0)` after close         |

## Production Considerations

### Kubernetes/Container Orchestration

```typescript
// Handle both signals commonly used by orchestrators
process.on('SIGTERM', shutdown) // Kubernetes default
process.on('SIGINT', shutdown) // Docker, local development
```

### Timeout Safety

```typescript
// Force exit if graceful shutdown takes too long
setTimeout(() => {
  console.error('[SHUTDOWN] Timeout - forcing exit')
  process.exit(1)
}, 10000) // 10 second max
```

### Health Check During Shutdown

```typescript
function shutdown() {
  shuttingDown = true
  notifySSEClientsOfShutdown()

  // Stop accepting new connections
  server.close()

  setTimeout(() => {
    server.closeAllConnections()
    process.exit(0)
  }, 1000)
}
```

## Testing Graceful Shutdown

```typescript
it('notifies all clients on shutdown', () => {
  // Connect multiple clients
  let controller1 = new AbortController()
  let controller2 = new AbortController()
  // ... connect clients ...

  // Trigger shutdown
  notifySSEClientsOfShutdown()

  // Both clients should receive shutdown event
  // ... read streams and verify ...
})
```

## 📂 Codebase References

**Server**: `demos/sse/server.ts` (38 lines)
**Router**: `demos/sse/app/router.tsx` - notifySSEClientsOfShutdown()
**Shutdown event**: `sse/guides/sse-event-types.md`
