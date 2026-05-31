<!-- Context: sse/decisions/ADR-001-in-memory-state | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# ADR-001: In-Memory State Management

**Status**: accepted  
**Date**: 2026-03-22  
**Context**: demos/sse | **Module**: router.tsx (lines 16-38)  
**Related Tasks**: N/A  
**Related ADRs**: N/A

---

## Context

The SSE demo requires persistent state to track:

- Connected SSE clients (controller → room/username mapping)
- Rate limiting state (last message time per user per room)
- Logged-in users (username → controller mapping)
- Server metrics

**Problem**: How should application state be stored and managed?

## Decision

Use JavaScript Map data structures stored in-memory, without any persistent database or external storage.

```typescript
let connectedClients = new Map<
  ReadableStreamDefaultController,
  { room: string; username: string }
>()
let lastMessageTime = new Map<string, number>()
let loggedInUsers = new Map<string, ReadableStreamDefaultController | null>()
```

## Alternatives Considered

### Option 1: Redis or External Database

- **Pros**: Survives server restarts, supports horizontal scaling, handles connection failover
- **Cons**: Adds infrastructure complexity, requires connection management, latency overhead, additional cost
- **Why rejected**: Demo scope doesn't require multi-process resilience; adds unnecessary complexity

### Option 2: File-based Persistence

- **Pros**: Survives restarts without external infrastructure
- **Cons**: Synchronous I/O blocks event loop, race conditions on concurrent writes, no atomic updates
- **Why rejected**: Blocks server performance, poor concurrent access handling

### Option 3: No State (Stateless Design)

- **Pros**: Simple to implement, horizontally scalable
- **Cons**: Cannot track message history, rate limiting, or session state across requests
- **Why rejected**: Core features (rate limiting, duplicate login prevention, room broadcasting) require state

## Consequences

### Positive

- Simple to understand and debug
- Zero latency for state operations
- No external dependencies or infrastructure
- Works out of the box with no setup

### Negative

- All state lost on server restart
- Cannot scale beyond single process without additional coordination
- Memory usage grows with connected clients (potential memory pressure in long-running demos)

### Neutral

- Appropriate for demo/local development only
- Production deployments would need to evaluate scaling requirements

---

## Implementation Notes

State cleanup for rate limiting is handled via periodic TTL cleanup (lines 68-78 in router.tsx), removing stale entries every 50 seconds to prevent unbounded memory growth.
