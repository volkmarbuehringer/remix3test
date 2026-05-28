<!-- Context: development/remix3/guides/stream-patterns | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Stream Patterns

Advanced ReadableStream patterns for Remix 3.

## Basic SSE Stream
```typescript
router.map({
  messages(context) {
    let stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(`event: init\ndata: {}\n\n`)) },
      cancel() { /* Cleanup on client disconnect */ },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  },
})
```

## Stream with Interval
```typescript
router.map({
  messages(context) {
    let stream = new ReadableStream({
      start(controller) {
        let count = 0, limit = 10
        let interval = setInterval(() => {
          try {
            count++
            controller.enqueue(new TextEncoder().encode(`event: tick\ndata: ${JSON.stringify({ count, time: Date.now() })}\n\n`))
            if (count >= limit) { clearInterval(interval); controller.close() }
          } catch { clearInterval(interval); controller.close() }
        }, 1000)
        context.request.signal.addEventListener('abort', () => clearInterval(interval))
      },
    })
    return new Response(stream, { headers: SSE_HEADERS })
  },
})
```

## Broadcasting to Multiple Clients
```typescript
let clients = new Set<ReadableStreamDefaultController>()
function broadcast(event: string, data: object) {
  let msg = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  clients.forEach(c => { try { c.enqueue(msg) } catch { clients.delete(c) } })
}
router.map({ messages(context) {
  let stream = new ReadableStream({
    start(c) { clients.add(c) }, cancel() { clients.delete(controller) },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}})
```

## Stream with Backpressure
```typescript
router.map({ messages(context) {
  let stream = new ReadableStream({
    start(controller) {
      let queue = []
      function processQueue() {
        while (queue.length > 0 && controller.desiredSize > 0) controller.enqueue(queue.shift())
      }
      queue.push(new TextEncoder().encode('data: ...\n\n'))
      processQueue()
    },
  })
  return new Response(stream, { headers: SSE_HEADERS })
}})
```

## Transforming and Composing
```typescript
let transformed = readableStream.pipeThrough(new TransformStream({
  transform(chunk, controller) {
    let data = JSON.parse(new TextDecoder().decode(chunk))
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ ...data, serverTime: Date.now() })))
  },
}))
let MAX_QUEUE_SIZE = 100
function enqueueMessage(msg: string) { messageQueue.push(msg); if (messageQueue.length > MAX_QUEUE_SIZE) messageQueue.shift(); broadcastMessages() }
```

## Error Recovery
```typescript
let stream = new ReadableStream({
  start(controller) { try { /* Setup */ } catch (error) { controller.error(error) } },
  cancel(reason) { cleanup(reason) },
})
```

## Testing Streams
```typescript
it('streams data', async () => {
  let reader = (await router.fetch(new Request('/stream'))).body.getReader()
  let chunks: string[] = []
  while (true) { let { done, value } = await reader.read(); if (done) break; chunks.push(new TextDecoder().decode(value)) }
  assert.ok(chunks.some(c => c.includes('event: init')))
})
```

## 📂 Codebase References
**Full implementation**: `demos/sse/app/router.tsx`
**Heartbeat example**: SSE streaming demo
