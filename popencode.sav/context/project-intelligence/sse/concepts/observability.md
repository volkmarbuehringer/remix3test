<!-- Context: sse/core/concepts/observability | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Observability

Structured logging and metrics for SSE applications.

## Structured JSON Logging

Log events in JSON format for easy parsing by log aggregators:

```typescript
function logStructured(event: string, data: Record<string, unknown>) {
  let logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
    memory: process.memoryUsage().heapUsed, // Track memory
  }
  console.log(JSON.stringify(logEntry))
}
```

### Log Event Examples

```typescript
// Connection established
logStructured('connection', { username, room })

// Client disconnected
logStructured('disconnection', { username, room })

// Message broadcast
logStructured('broadcast', {
  username,
  room,
  recipient: recipient || 'everyone',
  messageLength: messageText.length,
  recipients: targetControllers.length,
})

// Rate limit triggered
logStructured('rate_limited', { username, room, key: rateKey })

// Duplicate connection rejected
logStructured('connection_rejected', { username, reason: 'already_logged_in' })
```

## Log Output Format

```json
{
  "timestamp": "2026-03-22T10:30:00.000Z",
  "event": "broadcast",
  "username": "alice",
  "room": "general",
  "recipient": "everyone",
  "messageLength": 42,
  "recipients": 5,
  "memory": 15728640
}
```

## Metrics Tracking

Track operational metrics for monitoring:

```typescript
let metrics = {
  messagesBroadcastTotal: 0,
  messagesRateLimitedTotal: 0,
  connectionsTotal: 0,
}

// Increment on events
metrics.connectionsTotal++
metrics.messagesBroadcastTotal++
metrics.messagesRateLimitedTotal++
```

## Health Endpoint

Expose metrics via health endpoint:

```typescript
export function getServerMetrics() {
  let uniqueRooms = new Set<string>()
  connectedClients.forEach((clientInfo) => uniqueRooms.add(clientInfo.room))

  return {
    status: 'ok',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    clients: connectedClients.size,
    rooms: uniqueRooms.size,
    rateLimitMapSize: lastMessageTime.size,
    metrics: { ...metrics },
  }
}

router.map({
  health(context) {
    return Response.json(getServerMetrics())
  },
})
```

### Health Response

```json
{
  "status": "ok",
  "uptime": 3600,
  "clients": 12,
  "rooms": 3,
  "rateLimitMapSize": 5,
  "metrics": {
    "messagesBroadcastTotal": 1042,
    "messagesRateLimitedTotal": 23,
    "connectionsTotal": 45
  }
}
```

## Memory Monitoring

Track memory usage in logs:

```typescript
function logWithMemory(event: string, data: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...data,
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
    }),
  )
}
```

### Memory Leak Prevention

Stale rate limit entries can cause memory leaks:

```typescript
const RATE_LIMIT_CLEANUP_MS = 50000 // 50 seconds

function cleanupRateLimitEntries() {
  let cutoff = Date.now() - RATE_LIMIT_CLEANUP_MS
  for (let [key, timestamp] of lastMessageTime) {
    if (timestamp < cutoff) {
      lastMessageTime.delete(key)
    }
  }
}

// Run cleanup periodically
setInterval(cleanupRateLimitEntries, RATE_LIMIT_CLEANUP_MS)
```

## Log Levels

| Level   | When               | Example                           |
| ------- | ------------------ | --------------------------------- |
| `info`  | Normal operations  | Connection, broadcast, disconnect |
| `warn`  | Recoverable issues | Rate limit, retry                 |
| `error` | Failures           | Stream error, encoding error      |

## Observability Stack

| Tool                 | Purpose           |
| -------------------- | ----------------- |
| Structured JSON logs | Event tracking    |
| Health endpoint      | Metrics scraping  |
| Memory profiling     | Leak detection    |
| Connection tracking  | Capacity planning |

## Key Metrics to Track

| Metric                     | Why             |
| -------------------------- | --------------- |
| `connectionsTotal`         | Load trends     |
| `messagesBroadcastTotal`   | Activity levels |
| `messagesRateLimitedTotal` | Abuse detection |
| `clients` (real-time)      | Current load    |
| `heapUsed` (per log)       | Memory leaks    |

## 📂 Codebase References

**Logging**: `demos/sse/app/router.tsx` - logStructured(), metrics
**Health endpoint**: `demos/sse/app/router.tsx` - health() handler
**Memory cleanup**: `demos/sse/app/router.tsx` - cleanupRateLimitEntries()
