<!-- Context: sse/errors/sse-middleware-issues | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# SSE Middleware & Debugging

Middleware issues and debugging techniques for SSE.

## Compression Breaking SSE

**Problem**: Compression middleware buffers and corrupts SSE.

**Fix**: Exclude SSE routes from compression:

```typescript
middleware.push(
  compression({
    filter: (request) => {
      if (request.url.includes('/messages')) return false
      return true
    },
  }),
)
```

---

## Logger Buffering

**Problem**: Logger middleware buffers SSE responses.

**Fix**: Only log in development, skip SSE routes:

```typescript
if (process.env.NODE_ENV === 'development') {
  middleware.push(
    logger({
      filter: (request) => !request.url.includes('/messages'),
    }),
  )
}
```

---

## Debugging Tips

### Check Network Tab

1. Open DevTools → Network
2. Filter by `EventSource` or `WS` (SSE uses HTTP)
3. Look for requests to `/messages`
4. Check "EventStream" response tab

### Log Controller State

```typescript
start(controller) {
  console.log('SSE connected')
  this._controller = controller
}

cancel() {
  console.log('SSE disconnected')
}
```

### Test with curl

```bash
curl -N http://localhost:44100/messages
# -N disables buffering
```

## 📂 Codebase References

**Middleware Setup**: `demos/sse/app/router.tsx` - Compression and logger middleware configuration
**Server**: `demos/sse/server.ts` - HTTP server with graceful shutdown
