<!-- Context: sse/errors/sse-memory-issues | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Memory & Encoding Issues

Memory management and encoding problems in SSE implementation.

## Stale Controllers

**Symptoms**: Memory grows over time, clients no longer receive events.

**Cause**: Dead controllers remain in Map.

**Fix**: Cleanup in broadcast loop:

```typescript
connectedClients.forEach((info, controller) => {
  try {
    controller.enqueue(data)
  } catch {
    connectedClients.delete(controller)
  }
})
```

---

## Unbounded Client Map

**Symptoms**: Map grows infinitely, memory leak.

**Cause**: Clients never removed.

**Fix**: Always cleanup on `cancel()`:

```typescript
let stream = new ReadableStream({
  start(controller) {
    connectedClients.set(controller, { room, username })
  },
  cancel(controller) {
    connectedClients.delete(controller)
    broadcastUserList(room)
  },
})
```

---

## Double Encoding

**Problem**: JSON being double-encoded.

**Wrong**:

```typescript
let data = JSON.stringify({ users: ['a', 'b'] })
controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
// Results in: data: "{\"users\":[\"a\",\"b\"]}"
```

**Correct**:

```typescript
let data = { users: ['a', 'b'] }
controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
// Results in: data: {"users":["a","b"]}
```

---

## Missing Newlines

**Problem**: Events missing `\n\n` terminator.

**Wrong**:

```typescript
controller.enqueue(new TextEncoder().encode(`event: users\ndata: ${data}\n`))
```

**Correct**:

```typescript
controller.enqueue(new TextEncoder().encode(`event: users\ndata: ${data}\n\n`))
```

## 📂 Codebase References

**Implementation**: `demos/sse/app/router.tsx` - Proper cleanup in broadcast and abort handlers
