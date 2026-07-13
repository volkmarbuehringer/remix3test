---
name: mastra-agent-single-request-streaming
description: "Pipe Mastra agent fullStream directly into POST response, replacing two-connection POST+SSE protocol"
user-invocable: false
origin: auto-extracted
---

# Single-Request Agent Streaming for Remix 3 + Mastra

**Extracted:** 2026-07-13
**Context:** Eliminating the two-connection POST+SSE protocol (action → runId → SSE stream) by piping the agent's `fullStream` directly into the POST response body.

## Problem

The standard Mastra streaming pattern in Remix 3 uses two connections:

1. **POST** to `/agent-path` → calls `agent.stream(message)` → stores `fullStream` in an in-memory stream-store → returns `{ runId }` as JSON
2. **GET** `/agent-path/stream/:runId` → reads the stored stream via EventSource → pipes chunks as SSE events

This requires:

- An in-memory stream-store (`Map<runId, StoredStream>`) with TTL cleanup
- A separate SSE endpoint with duplicate auth checks and runId ownership verification
- Two-connection lifecycle on the client (fetch + EventSource)
- runId bookkeeping and EventSource management in clientEntry code
- Orphaned stream cleanup on disconnect, memory pressure from unfinished streams

## Solution

Call `agent.stream()` inside the POST action handler's `ReadableStream.start` function, emit a `start` SSE event with `{ runId, threadId }`, then pipe the agent's `fullStream` directly into the same response body. No stored streams, no second connection, no EventSource.

### Server-side (controller)

```
                      POST /route-agent
                             │
                    ┌────────▼────────┐
                    │  Validate input  │
                    │  Rate limit      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Return SSE     │
                    │  Response       │
                    │  immediately    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  agent.stream() │  ← inside ReadableStream.start
                    │  emit 'start'   │     { runId, threadId }
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  pipeStream()   │  ← read fullStream → write SSE
                    │  (single loop)  │     message, navigate, question, etc.
                    └─────────────────┘
```

Core implementation:

```typescript
async action(context) {
  // Validation + rate limiting (return SSE error responses)

  let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

  let body = new ReadableStream({
    start: async (controller) => {
      try {
        let agent = mastra.getAgent('routeAgent')
        let output = await agent.stream(message, {
          memory: { thread: threadId, resource: 'route-user' },
        })
        // Emit starting info so client can track thread/run for question flow
        controller.enqueue(
          sseEncoder.encode(
            `event: start\ndata: ${JSON.stringify({ runId: output.runId, threadId })}\n\n`,
          ),
        )
        pipeStream(output.fullStream, controller, context.request.signal, output.runId)
      } catch (err) {
        controller.enqueue(sseEncoder.encode(`event: agent-error\ndata: ...\n\n`))
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(body, { headers: sseHeaders() })
}
```

The `pipeStream` helper reads from the agent's `fullStream` and writes SSE events to the response controller:

```typescript
function pipeStream(
  fullStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
  runId?: string,
) {
  let reader: ReadableStreamDefaultReader<unknown>
  let closed = false

  function closeOnce() {
    if (closed) return
    closed = true
    try { controller.close() } catch { /* already closed */ }
  }

  ;(async () => {
    reader = fullStream.getReader()
    if (signal.aborted) {
      reader.cancel().catch(() => {})
      closeOnce()
      return
    }
    signal.addEventListener('abort', () => {
      reader?.cancel().catch(() => {})
      closeOnce()
    }, { once: true })

    try {
      while (true) {
        let { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) { closeOnce(); return }
        if (!value || typeof value !== 'object') continue

        let chunk = value as Record<string, unknown>
        let result = filterAndForward(chunk, controller, runId)
        if (result === 'suspended') {
          reader?.cancel().catch(() => {})
          closeOnce()
          return  // Stream paused — client will POST answer/approve
        }
      }
      closeOnce()
    } catch (err) {
      controller.enqueue(sseEncoder.encode(`event: stream-error\ndata: ...\n\n`))
      closeOnce()
    }
  })()
}
```

### SSE headers helper

```typescript
function sseHeaders() {
  let headers = new SuperHeaders()
  headers.contentType = { mediaType: 'text/event-stream' }
  headers.cacheControl = { noCache: true, noStore: true }
  headers.connection = 'keep-alive'
  headers.set('X-Accel-Buffering', 'no')
  return headers
}
```

### Error responses also use SSE

All error responses should return `text/event-stream` content type so the client can use a single parser:

```typescript
return new Response(
  sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Message is required' })}\n\n`),
  { status: 400, headers: sseHeaders() },
)
```

The client reads the response body on non-2xx to extract the error from the SSE `data:` line:

```typescript
if (!res.ok) {
  let text = await res.text().catch(() => '')
  let match = text.match(/data: (.*)\n/)
  let msg = match ? (JSON.parse(match[1]).error ?? res.statusText) : res.statusText
  showError(msg)
  return
}
```

### Client-side

Replace EventSource with `fetch()` + `response.body.getReader()`:

```typescript
async function startStream(url: string, init: RequestInit) {
  let res = await fetch(url, { ...init, signal })
  let reader = res.body!.getReader()
  let decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (let part of parts) {
      let lines = part.split('\n')
      let eventType = ''
      let data = ''
      for (let line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) data = line.slice(6)
      }
      if (!data) continue

      let parsed = JSON.parse(data)
      // Handle each event type: start, message, navigate, question, etc.
    }
  }
}
```

### SSE event types to forward

Only forward event types the UI actually consumes. Drop Mastra internal events (step-start/end, reasoning-*, text-*, tool-call-*, etc.):

| Event | Payload | Client action |
|-------|---------|---------------|
| `start` | `{ runId, threadId }` | Store for question/answer flow |
| `message` | `{ text }` | Append to streaming text |
| `navigate` | `{ href, target, history }` | `frame.src = href; frame.reload(); history.pushState()` |
| `question` | `{ runId, toolCallId, question, options, selectionMode }` | Show question UI |
| `suspension` | `{ toolCallId, toolName, args }` | Show approval UI; POST to tool-decision |
| `tool-result` | `{ toolCallId, toolName, result }` | Optional display |
| `tool-error` | `{ toolCallId, toolName, error }` | Show error |
| `complete` | `{}` | Stream ended, re-enable form |
| `agent-error` | `{ error }` | Show error |
| `stream-error` | `{ error }` | Show error |

### Answer and tool-decision endpoints

The same single-request pattern applies to the `answer` and `tool-decision` endpoints — they also call agent methods (`resumeStream`, `approveToolCallGenerate`) and pipe the resulting stream:

```typescript
async answer(context) {
  // validate...
  let body = new ReadableStream({
    start: async (controller) => {
      let output = await agent.resumeStream(resumeData, { runId, toolCallId })
      controller.enqueue(sseEncoder.encode(`event: start\ndata: ${JSON.stringify({ runId: output.runId })}\n\n`))
      pipeStream(output.fullStream, controller, context.request.signal)
    },
  })
  return new Response(body, { headers: sseHeaders() })
}
```

## When to Use

- Building a new Mastra agent controller in Remix 3
- Refactoring an existing two-connection controller (POST + SSE) into a single-request pattern
- Eliminating stream-store.ts / in-memory stream caching from the architecture
- Simplifying clientEntry code by removing EventSource, runId bookkeeping, and reconnection logic

## Key Differences from Two-Connection Pattern

| Aspect | Two-connection | Single-request |
|--------|---------------|----------------|
| Requests | POST (start) + GET (SSE stream) | One POST |
| Server state | stream-store.ts with TTL | None — consumed inline |
| Client protocol | fetch + EventSource | `fetch()` + reader |
| Error handling | JSON for errors, SSE for stream | SSE for everything |
| Auth checks | Separate check on each endpoint | Single check in action |
| Orphan cleanup | TTL timers, memory pressure | Stream dies with request |
| Proxy timeout | SSE open indefinitely | Same — open for agent duration |

## Related Skills

- `mastra-askusertool-stream-integration` — wiring askUserTool questions into the SSE flow (complements this pattern)
- `remix3-agent-driven-frame-navigation` — agent-driven frame navigation using the `navigate` event type
