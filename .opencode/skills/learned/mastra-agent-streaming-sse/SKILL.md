---
name: mastra-agent-streaming-sse
description: 'Pipe Mastra agent fullStream into a single POST response with SSE events — askUserTool, requireToolApproval, and frame navigation'
origin: consolidated
---

# Mastra Agent Streaming via SSE (Single-Request Pattern)

**Consolidated from:** `mastra-agent-single-request-streaming`, `mastra-askusertool-stream-integration`, `mastra-stream-requiretoolapproval-snapshot`

Covers three aspects of the single-request streaming pattern:
1. Core transport: piping `agent.stream()` `fullStream` directly into the POST response body
2. askUserTool integration: `tool-call-suspended` events and `resumeStream` answer endpoint
3. requireToolApproval snapshot loss: function-based approval callback lost on resume

---

## Part 1: Single-Request Stream Transport

### Problem

The standard Mastra streaming pattern in Remix 3 uses two connections:

1. **POST** to `/agent-path` → calls `agent.stream(message)` → stores `fullStream` in an in-memory stream-store → returns `{ runId }` as JSON
2. **GET** `/agent-path/stream/:runId` → reads the stored stream via EventSource → pipes chunks as SSE events

This requires an in-memory stream-store with TTL cleanup, a separate SSE endpoint with duplicate auth, two-connection lifecycle, and runId bookkeeping.

### Solution

Call `agent.stream()` inside the POST action handler's `ReadableStream.start` function, emit a `start` SSE event, then pipe the agent's `fullStream` directly into the same response body.

```
POST /route-agent
       │
┌──────▼────────┐
│  Validate      │
│  Rate limit    │
└──────┬────────┘
       │
┌──────▼────────┐
│  Return SSE    │
│  Response      │
└──────┬────────┘
       │
┌──────▼──────────────┐
│  agent.stream()     │
│  inside start       │
│  emit 'start' event │
└──────┬──────────────┘
       │
┌──────▼──────────┐
│  pipeStream()   │
│  → filterAndFwd │
└─────────────────┘
```

#### Server (controller)

```typescript
async action(context) {
  let threadId = context.formData.get('threadId')?.toString() || crypto.randomUUID()

  let body = new ReadableStream({
    start: async (controller) => {
      try {
        let agent = mastra.getAgent('routeAgent')
        let output = await agent.stream(message, {
          memory: { thread: threadId, resource: 'route-user' },
        })
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

#### pipeStream helper

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
    if (closed) return; closed = true
    try { controller.close() } catch { /* already closed */ }
  }

  ;(async () => {
    reader = fullStream.getReader()
    if (signal.aborted) { reader.cancel().catch(() => {}); closeOnce(); return }
    signal.addEventListener('abort', () => { reader?.cancel().catch(() => {}); closeOnce() }, { once: true })

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
          return
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

#### SSE headers

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

#### Client-side

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

#### SSE event types

| Event          | Payload                                                   | Client action                                           |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `start`        | `{ runId, threadId }`                                     | Store for question/answer flow                          |
| `message`      | `{ text }`                                                | Append to streaming text                                |
| `navigate`     | `{ href, target, history }`                               | `frame.src = href; frame.reload(); history.pushState()` |
| `question`     | `{ runId, toolCallId, question, options, selectionMode }` | Show question UI                                        |
| `suspension`   | `{ toolCallId, toolName, args }`                          | Show approval UI; POST to tool-decision                 |
| `tool-result`  | `{ toolCallId, toolName, result }`                        | Optional display                                        |
| `tool-error`   | `{ toolCallId, toolName, error }`                         | Show error                                              |
| `complete`     | `{}`                                                      | Stream ended, re-enable form                            |
| `agent-error`  | `{ error }`                                               | Show error                                              |
| `stream-error` | `{ error }`                                               | Show error                                              |

---

## Part 2: askUserTool Integration

### Problem

Mastra's `askUserTool` uses a different suspension mechanism than `requireApproval`:

| Aspect            | `requireApproval`                | `askUserTool`                                                                      |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| Stream chunk type | `tool-call-approval`             | `tool-call-suspended`                                                              |
| Resume method     | `approveToolCallGenerate`        | `resumeStream(resumeData, { runId })`                                              |

### filterAndForward: handle both suspension types

```typescript
function filterAndForward(
  chunk: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
  runId?: string,
): 'suspended' | undefined {
  let p = chunk.payload as Record<string, unknown> | undefined
  let type = chunk.type as string

  function fwd(type: string, data: unknown) {
    controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  if (type === 'tool-call-approval') {
    fwd('suspension', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
    })
    return 'suspended'
  }

  if (type === 'tool-call-suspended') {
    let sp = p?.suspendPayload as
      | { question?: string; options?: { label: string; description?: string }[]; selectionMode?: string }
      | undefined
    if (sp?.question) {
      fwd('question', {
        runId,
        toolCallId: p?.toolCallId,
        question: sp.question,
        options: sp.options ?? null,
        selectionMode: sp.selectionMode ?? 'single_select',
      })
    }
    return 'suspended'
  }

  if (type === 'tool-result') {
    let result = p?.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      fwd('navigate', { href: result.path, target: 'lists-content', history: 'push' })
    } else {
      fwd('tool-result', { toolCallId: p?.toolCallId, toolName: p?.toolName, result, isError: p?.isError })
    }
  }
}
```

### Answer endpoint (resumeStream)

```typescript
async answer(context) {
  let runId = context.formData.get('runId')?.toString()
  let answerRaw = context.formData.get('answer')?.toString()
  let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
  let selectionMode = context.formData.get('selectionMode')?.toString()

  if (!runId || !answerRaw) {
    return new Response(
      sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Missing runId or answer' })}\n\n`),
      { status: 400, headers: sseHeaders() },
    )
  }

  let resumeData: unknown = answerRaw
  if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
    try { resumeData = JSON.parse(answerRaw) } catch { /* keep as string */ }
  }

  let body = new ReadableStream({
    start: async (controller) => {
      try {
        let agent = mastra.getAgent('routeAgent')
        let output = await agent.resumeStream(resumeData, { runId, toolCallId })
        controller.enqueue(
          sseEncoder.encode(`event: start\ndata: ${JSON.stringify({ runId: output.runId })}\n\n`),
        )
        pipeStream(output.fullStream as unknown as ReadableStream, controller, context.request.signal)
      } catch (err) {
        controller.enqueue(sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Failed to resume' })}\n\n`))
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(body, { headers: sseHeaders() })
}
```

### Client answer flow

```typescript
async function handleAnswer(answer: string) {
  if (!pendingQuestion || !answer) return
  let body = new FormData()
  body.set('runId', pendingQuestion.runId)
  body.set('answer', answer)
  body.set('selectionMode', pendingQuestion.selectionMode)
  if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
  if (currentThreadId) body.set('threadId', currentThreadId)
  startStream('/agent/answer', { method: 'POST', body })
}
```

Only hide the question card and clear `pendingQuestion` **after** `startStream` begins — otherwise a network error strands the suspended agent run.

---

## Part 3: requireToolApproval Snapshot Loss

### Problem

When a tool requires approval, Mastra persists a snapshot to storage. The snapshot **cannot serialize JavaScript functions**. When you call `approveToolCallGenerate()` or `declineToolCallGenerate()` to resume, the `requireToolApproval` function is gone. The resumed agent executes the tool without the approval gate.

```typescript
// Initial stream — gates readTestFile
let output = await agent.stream(message, {
  requireToolApproval: (ctx) => ctx.toolName === 'readTestFile',
})

// ... later, on approval:
// ❌ requireToolApproval is lost from snapshot
let result = await agent.approveToolCallGenerate({ runId, toolCallId })
// resumed agent may bypass the approval check
```

### Solution

Re-pass `requireToolApproval` to all resume methods:

```typescript
const requireApproval = (ctx: { toolName: string }) =>
  ctx.toolName === 'readTestFile'

// Initial stream
let output = await agent.stream(message, {
  requireToolApproval: requireApproval,
})

// ✅ Re-pass on resume
let result = await agent.approveToolCallGenerate({
  runId, toolCallId,
  requireToolApproval: requireApproval,
})

let declined = await agent.declineToolCallGenerate({
  runId, toolCallId,
  requireToolApproval: requireApproval,
})
```

### Detection

Suspect this issue when:
- Approval works on the first tool call but is silently bypassed on subsequent calls
- After approving/declining, the tool executes without the expected approval prompt
- The resumed run permits tool calls that were previously gated by `requireToolApproval`

---

## Key Differences from Two-Connection Pattern

| Aspect          | Two-connection                  | Single-request                 |
| --------------- | ------------------------------- | ------------------------------ |
| Requests        | POST (start) + GET (SSE stream) | One POST                       |
| Server state    | stream-store.ts with TTL        | None — consumed inline         |
| Client protocol | fetch + EventSource             | `fetch()` + reader             |
| Error handling  | JSON for errors, SSE for stream | SSE for everything             |
| Auth checks     | Separate check on each endpoint | Single check in action         |
| Orphan cleanup  | TTL timers, memory pressure     | Stream dies with request       |
| Proxy timeout   | SSE open indefinitely           | Same — open for agent duration |

## When to Use

- Building a Mastra agent controller in Remix 3 with streaming SSE
- Adding `askUserTool` questions to an agent that already uses `requireApproval`
- Using function-based `requireToolApproval` with snapshot-resumed agents
- Replacing the two-connection POST + EventSource protocol

## Related Skills

- `remix3-agent-routing` — agent-driven frame navigation and form prefill using the `navigate` event
- `remix-security-middleware` — CSRF bypass for SSE endpoints (`/mastra/chat`, `/route-agent`)
- `rate-limiter-pitfalls` — rate limiter configuration for multi-step agent flows
- `mastra-tool-approval-generate` — hard-gating tools with `generate()` (non-streaming)
