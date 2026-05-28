<!-- Context: development/remix3/guides/rate-limiting | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Rate Limiting

Generic server-side rate limiting pattern for Remix loaders and actions using in-memory timestamp tracking.

## Problem

Prevent abuse or spam by limiting how often a user can perform an action (send messages, submit forms, hit endpoints).

## Solution

Track last execution time per user/key and enforce a minimum interval between actions.

## Implementation

```typescript
const RATE_LIMIT_MS = 500
let lastExecutionTime = new Map<string, number>()

export function checkRateLimit(key: string, limitMs = RATE_LIMIT_MS): boolean {
  let now = Date.now()
  let last = lastExecutionTime.get(key) ?? 0
  if (now - last < limitMs) {
    return false // rate limited
  }
  lastExecutionTime.set(key, now)
  return true
}
```

## Usage in Route Action

```typescript
export async function action({ request }: Route.ActionArgs) {
  let formData = await request.formData()
  let userId = formData.get('userId') as string
  let roomId = formData.get('roomId') as string
  let key = `${userId}:${roomId}`

  if (!checkRateLimit(key)) {
    return json({ error: 'Please wait before sending another message' }, { status: 429 })
  }

  // process the action...
}
```

## Key Generation

Generate meaningful keys based on what you're rate limiting:

| Scope           | Key Pattern                                 | Example                 |
| --------------- | ------------------------------------------- | ----------------------- |
| Per user        | `${userId}`                                 | `user-123`              |
| Per room        | `${roomId}`                                 | `room-general`          |
| Per user + room | `${userId}:${roomId}`                       | `user-123:room-general` |
| Per IP          | `${request.headers.get("x-forwarded-for")}` | `192.168.1.1`           |

## Configuration

| Variable        | Default | Description                          |
| --------------- | ------- | ------------------------------------ |
| `RATE_LIMIT_MS` | `500`   | Minimum milliseconds between actions |

Adjust based on use case:

- **Chat messages**: 500ms (fast but not spammy)
- **Form submissions**: 1000ms+ (user-friendly)
- **API endpoints**: 100ms-5000ms depending on sensitivity

## Memory Management

The Map-based implementation can grow unbounded if entries are never removed. Add TTL cleanup:

```typescript
const RATE_LIMIT_CLEANUP_MS = RATE_LIMIT_MS * 100 // 50 seconds

function cleanupStaleEntries() {
  let cutoff = Date.now() - RATE_LIMIT_CLEANUP_MS
  for (let [key, timestamp] of lastExecutionTime) {
    if (timestamp < cutoff) {
      lastExecutionTime.delete(key)
    }
  }
}

// Run cleanup periodically
setInterval(cleanupStaleEntries, RATE_LIMIT_CLEANUP_MS)
```

## Notes

- This is in-memory and resets on server restart (not distributed)
- For distributed systems, use Redis or a similar key-value store
- Consider adding rate limit headers (`X-RateLimit-Reset`, `Retry-After`)
- **Always add TTL cleanup** to prevent unbounded memory growth
