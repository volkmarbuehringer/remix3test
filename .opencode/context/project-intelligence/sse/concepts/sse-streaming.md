<!-- Context: sse/core/concepts/sse-streaming | Priority: high | Version: 1.1 | Updated: 2026-03-22 -->

# SSE Streaming

Server-Sent Events (SSE) provides one-way real-time streaming from server to client over HTTP.

## Core Idea

Use `ReadableStream` with `text/event-stream` content type for real-time updates.

## SSE Format

```typescript
// Event format
event: <event-name>\n
data: <json-data>\n\n
```

## ReadableStream Implementation

```typescript
let stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
  },
  cancel() {
    // Cleanup when client disconnects
  },
})
```

## Response Headers

```typescript
new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  },
})
```

## Client Usage

```typescript
let eventSource = new EventSource('/messages')

eventSource.addEventListener('users', (e) => {
  updateUserList(JSON.parse(e.data).users)
})
```

## Related Files

- **Event Types**: `development/remix3/guides/sse-event-types.md` - Generic SSE event reference
- **Room Broadcasting**: `sse/core/concepts/room-broadcasting.md`
- **Full Implementation**: `development/remix3/guides/sse-implementation.md` - Complete guide

## 📂 Codebase References

**Implementation**: `demos/sse/app/router.tsx`
**Client**: `demos/sse/app/assets/message-stream.tsx`
