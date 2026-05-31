<!-- Context: sse/decisions/ADR-003-rate-limiting | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# ADR-003: Rate Limiting Implementation

**Status**: accepted  
**Date**: 2026-03-22  
**Context**: demos/sse | **Module**: router.tsx (lines 21-78)  
**Related Tasks**: N/A  
**Related ADRs**: ADR-001

---

## Context

The SSE demo allows users to broadcast messages to rooms. Without rate limiting, users could flood the channel or abuse the system.

**Problem**: How should the server prevent message spam while allowing legitimate use?

## Decision

Implement per-user, per-room rate limiting using a time-based window:

- **Threshold**: 500ms minimum between messages from the same user in the same room
- **Key**: `${username}:${room}` maps to timestamp
- **Cleanup**: Stale entries pruned every 50 seconds via `setInterval`
- **Response**: HTTP 302 redirect back to the page when rate limited

```typescript
const RATE_LIMIT_MS = 500
const RATE_LIMIT_CLEANUP_MS = RATE_LIMIT_MS * 100 // 50 seconds

let rateKey = `${username}:${room}`
let now = Date.now()
let lastTime = lastMessageTime.get(rateKey) ?? 0
if (now - lastTime < RATE_LIMIT_MS) {
  return new Response(null, { status: 302, headers: { Location: ... } })
}
lastMessageTime.set(rateKey, now)
```

## Alternatives Considered

### Option 1: Token Bucket Algorithm

- **Pros**: Allows burst traffic, more flexible, better for varying traffic patterns
- **Cons**: More complex implementation, requires tuning bucket size and refill rate
- **Why rejected**: Simplicity of fixed window is sufficient for chat use case

### Option 2: Leaky Bucket Algorithm

- **Pros**: Smooths traffic, predictable outflow, good for throttling
- **Cons**: More complex, may delay legitimate high-frequency users
- **Why rejected**: 500ms fixed window provides predictable UX for chat

### Option 3: Sliding Window Log

- **Pros**: More accurate than fixed window, reduces burst at boundaries
- **Cons**: Requires storing per-request timestamps, more memory, more complex
- **Why rejected**: Fixed window provides adequate accuracy for demo use case

### Option 4: No Rate Limiting

- **Pros**: No implementation complexity, no false positives
- **Cons**: Vulnerable to spam, abuse, DoS from single users
- **Why rejected**: Core feature requirement to prevent abuse

## Consequences

### Positive

- Prevents individual users from flooding rooms
- Simple to implement and understand
- Memory-efficient with TTL cleanup
- Non-blocking (check is O(1) Map lookup)

### Negative

- Fixed window has burst issue at window boundaries (2x messages possible at boundary)
- Legitimate users hit limit if typing fast (500ms is perceptible)
- No differentiation between user tiers (all users get same limit)

### Neutral

- Appropriate for chat/collaboration use case
- Production could add tiered limits for different user roles

---

## Implementation Notes

Cleanup runs every 50 seconds, removing entries older than that threshold. This prevents unbounded Map growth while keeping recent entries for accurate rate limiting.
