<!-- Context: sse/decisions/ADR-005-room-broadcasting | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# ADR-005: Room Broadcasting Architecture

**Status**: accepted  
**Date**: 2026-03-22  
**Context**: demos/sse | **Module**: router.tsx (lines 116-138, 467-518)  
**Related Tasks**: N/A  
**Related ADRs**: ADR-001, ADR-002

---

## Context

The SSE demo supports multiple chat rooms where messages should only be visible to users in the same room.

**Problem**: How should messages be routed to the correct recipients based on room membership?

## Decision

Use a single global `connectedClients` Map with room embedded in client metadata, filtering during broadcast:

```typescript
let connectedClients = new Map<
  ReadableStreamDefaultController,
  { room: string; username: string }
>()

// Broadcasting: O(n) iteration over all clients
connectedClients.forEach((clientInfo, controller) => {
  if (clientInfo.room !== room) return // Room filter
  if (clientInfo.username === username) return // Don't send to self
  // ... enqueue message
})
```

All clients maintain a connection, and messages are filtered client-side during broadcast. Room state is pushed to clients via the `users` event when members join/leave.

## Alternatives Considered

### Option 1: Map<room, Set<Controller>>

- **Pros**: O(1) room lookup, O(1) broadcast to room, faster filtering
- **Cons**: More complex data structure, double the Maps needed, harder to iterate for admin operations
- **Why rejected**: Implementation complexity for a demo; current O(n) is acceptable for scale

### Option 2: Separate SSE Endpoints per Room

- **Pros**: Each room is isolated, simpler per-endpoint logic
- **Cons**: Many endpoints, complex routing, harder to track global metrics
- **Why rejected**: Adds routing complexity; server already handles multiplexing

### Option 3: External Pub/Sub (Redis, EventEmitter)

- **Pros**: Handles scaling to multiple processes, decouples broadcast logic
- **Cons**: Additional infrastructure, more complex, latency
- **Why rejected**: Demo runs single-process; no scaling requirements

### Option 4: Room-Specific Connection Pools

- **Pros**: Natural room isolation at connection time
- **Cons**: Different connection pools needed, harder to broadcast to multiple rooms
- **Why rejected**: Increases server complexity for limited benefit

## Consequences

### Positive

- Simple implementation — room is just a string field
- Single connection per client regardless of room count
- Easy to implement room switch (just update room field in metadata)
- Global client iteration useful for server-wide announcements
- No additional infrastructure needed

### Negative

- O(n) broadcast — scales linearly with total clients, not just room clients
- More CPU for large rooms on busy server
- Cannot take advantage of room-based optimizations

### Neutral

- Appropriate for demo and small-to-medium room counts (<1000 total clients)
- Production at scale would benefit from room-based indexing

---

## Implementation Notes

- User list is maintained separately and broadcast to all room members via the `users` event on join/leave (lines 116-138, 380)
- Room names are sanitized (alphanumeric + dash only, max 50 chars) to prevent injection
- Maximum 100 clients per room is enforced at connection time
