<!-- Context: sse/errors/sse-connection-errors | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Connection Issues

Common connection problems and fixes for SSE implementation.

## Client Never Receives Events

**Symptoms**: EventSource connects but handlers never fire.

**Causes & Fixes**:

| Cause                                    | Fix                         |
| ---------------------------------------- | --------------------------- |
| Missing `text/event-stream` Content-Type | Set headers correctly       |
| nginx buffering                          | Add `X-Accel-Buffering: no` |
| Compression issues                       | Disable compression for SSE |
| CORS blocking                            | Allow cross-origin for SSE  |

**Verify headers**:

```typescript
console.log(response.headers.get('Content-Type'))
// Should be: text/event-stream
```

---

## Connection Drops Immediately

**Symptoms**: SSE connects then closes within seconds.

**Common causes**:

1. No keepalive being sent
2. Server restarting
3. Load balancer timeout
4. Idle connection timeout

**Fix with keepalive**:

```typescript
let keepalive = setInterval(() => {
  try {
    controller.enqueue(new TextEncoder().encode(`: keepalive\n\n`))
  } catch {
    clearInterval(keepalive)
  }
}, 30000)
```

---

## Reconnection Loop

**Symptoms**: Browser continuously reconnects without receiving data.

**Fix**: Send initial data quickly and implement retry delay:

```typescript
// Server: Send quickly on connect
controller.enqueue(new TextEncoder().encode(`data: {"status":"connected"}\n\n`))

// Client: Exponential backoff
let retryDelay = 1000
eventSource.onerror = () => {
  setTimeout(() => {
    retryDelay = Math.min(retryDelay * 2, 30000)
  }, retryDelay)
}
```

## 📂 Codebase References

**Headers**: `demos/sse/app/router.tsx` - SSE response headers with X-Accel-Buffering
**Client**: `demos/sse/app/assets/message-stream.tsx` - EventSource error handling
