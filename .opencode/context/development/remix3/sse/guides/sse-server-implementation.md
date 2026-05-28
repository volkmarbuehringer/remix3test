<!-- Context: development/remix3/guides/sse-server-implementation | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Guide: SSE — Server-Sent Events

**Core Idea**: End-to-end SSE from `~/remix/demos/sse/` — `ReadableStream` server endpoint streaming SSE events, with `EventSource` client consumption via `addEventListeners` and `queueTask`, plus abort cleanup on disconnect.

## Pattern: Server Endpoint

```typescript
messages({ request, url }) {
  let limit = getMessageLimit(url) // ?limit=N

  let stream = new ReadableStream({
    start(controller) {
      let messageCount = 0
      let interval = setInterval(() => {
        messageCount++
        let data = { count: messageCount, message: `Message #${messageCount} at ${new Date().toLocaleTimeString()}` }
        controller.enqueue(new TextEncoder().encode('event: message\n'))
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
        if (limit && messageCount >= limit) {
          clearInterval(interval)
          controller.close()
        }
      }, 1000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch { /* stream may already be closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

## Pattern: Client EventSource

```typescript
// Inside a clientEntry component, using queueTask for post-render DOM setup
import { addEventListeners, clientEntry, css, type Handle } from 'remix/ui'

export const MessageStream = clientEntry(
  import.meta.url,
  function MessageStream(handle: Handle<{ limit: number | null }>) {
    let messages: Array<{ count: number; message: string }> = []
    let connected = false

    handle.queueTask(() => {
      let eventSource = new EventSource(routes.messages.href(null, limit ? { limit } : {}))

      addEventListeners(eventSource, handle.signal, {
        open: () => { connected = true; handle.update() },
        message: (event) => {
          messages.push(JSON.parse(event.data))
          handle.update()
        },
        error: () => { connected = false; handle.update(); eventSource.close() },
      })

      handle.signal.addEventListener('abort', () => { eventSource.close() })
    })

    return () => (
      <>
        <div mix={connected ? connectedStyle : disconnectedStyle}>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        <ul>{messages.map(m => <li key={m.count}>#{m.count} {m.message}</li>)}</ul>
      </>
    )
  },
)
```

## Key Patterns

| Concern | Pattern |
|---------|---------|
| **SSE format** | `event: <name>\ndata: <json>\n\n` (two newlines between events) |
| **Interval cleanup** | `request.signal.addEventListener('abort', () => clearInterval(interval))` |
| **Client EventSource** | `new EventSource(url)` — auto-reconnects on disconnect |
| **Client cleanup** | `handle.signal.addEventListener('abort', () => eventSource.close())` |
| **Post-render setup** | `handle.queueTask(() => { ... })` — runs after DOM mount |
| **State updates** | `handle.update()` inside event callbacks to trigger re-render |
| **Limit parameter** | `?limit=N` passed to SSE endpoint URL, stops stream after N events |
| **Connection status** | Track `connected` flag via `open`/`error` events |

## Client Boot (entry.ts)

```typescript
import { run } from 'remix/ui'
run({
  async loadModule(moduleUrl, exportName) { return (await import(moduleUrl))[exportName] },
  async resolveFrame(src, signal, target) {
    let res = await fetch(src, { headers: { accept: 'text/html' }, signal })
    return res.body ?? res.text()
  },
})
```

## Reference

- Full demo: `~/remix/demos/sse/`
- Client-side SSE: `guides/client-side-sse.md`
- SSE in Frames: `guides/sse-in-frames.md`
- SSE event types: `guides/sse-event-types.md`
