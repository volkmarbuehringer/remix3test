---
name: mastra-agent
description: 'Mastra agent construction and output handling — inline model config, single-request SSE streaming, tool result extraction, and message content normalization'
origin: consolidated
---

# Mastra Agent Patterns

**Consolidated from:** `mastra-agent-inline-model-config`, `mastra-agent-streaming-sse`, `mastra-agent-toolresult-chunk-format`, `mastra-message-content-normalization`

Covers four aspects of working with Mastra agents:
1. Constructing agents without eager model resolution (inline model config)
2. Streaming `agent.stream()` output over SSE in a single POST request
3. Extracting tool results from `agent.generate()` (chunk vs flat format)
4. Normalizing Mastra's polymorphic message content to plain text

---

## Part 1: Inline Model Config (Defer Model Resolution)

### Problem

When constructing a Mastra `Agent` at module level, `model: getModel()` evaluates eagerly at import time. If the API key is missing or the provider isn't configured, the **entire app** crashes on startup — not just the AI route.

```ts
// BAD: throws at module load if OPENCODE_API_KEY is unset
export const agent = new Agent({
  model: getModel(), // <-- eagerly called at import time
  tools: { ... },
})
```

This is especially problematic when Mastra is embedded inside a larger app (Remix, Next.js) where other routes don't depend on the LLM.

### Solution

Use Mastra's inline model config object instead of a model instance. Mastra resolves it lazily at runtime when `agent.generate()` is first called.

```ts
// GOOD: stored as plain object, resolved lazily by Mastra
export const agent = new Agent({
  model: {
    providerId: 'opencode-go',
    modelId: 'deepseek-v4-flash',
    url: 'https://opencode.ai/zen/go/v1',
    apiKey: process.env.OPENCODE_API_KEY, // undefined is fine at import time
  },
  tools: { ... },
})
```

The inline config works with any OpenAI-compatible provider. The supported fields are:

- `providerId` — Provider identifier (matches the `name` in `createOpenAICompatible`)
- `modelId` — Model name (e.g. `deepseek-v4-flash`, `gpt-4o`)
- `url` — Base URL for the API endpoint
- `apiKey` — API key (can be `undefined`; only fails when the agent is actually used)

### Benefits

1. **No module-load crash** — missing API key only breaks the specific AI route, not the whole app
2. **Compatible with Mastra Studio** — agents can be registered in the `Mastra()` constructor via `agents: { agent }` without eager model evaluation
3. **Simpler test setup** — tests that don't exercise the agent won't crash on missing credentials
4. **Works with lazy getters** — combine with a lazy singleton pattern for deferred construction

### Combined with Lazy Registration

For maximum resilience, combine with a lazy getter and `mastra.addAgent()`:

```ts
let _agent: Agent | null = null

export function getSupportAgent(): Agent {
  if (!_agent) {
    _agent = new Agent({
      model: { providerId: '...', modelId: '...', url: '...', apiKey: process.env.API_KEY },
      tools: { ... },
    })
    mastra.addAgent(_agent) // register so Mastra Studio can see it
  }
  return _agent
}
```

### When to Use

- Embedding Mastra agents inside a non-Mastra framework (Remix, Next.js, Express, Fastify)
- Multiple routes where some use AI and others don't — you don't want every route to fail when the API key is missing
- Setting up a Mastra dev server (`mastra dev`) alongside an existing app — the CLI entry point can re-export the same agent config
- Tests that need to import the module without triggering model initialization

---

## Part 2: Streaming via SSE (Single-Request Pattern)

### Problem

The standard Mastra streaming pattern in Remix 3 uses two connections:

1. **POST** to `/agent-path` → calls `agent.stream(message)` → stores `fullStream` in an in-memory stream-store → returns `{ runId }` as JSON
2. **GET** `/agent-path/stream/:runId` → reads the stored stream via EventSource → pipes chunks as SSE events

This requires an in-memory stream-store with TTL cleanup, a separate SSE endpoint with duplicate auth, two-connection lifecycle, and runId bookkeeping.

### Solution

Call `agent.stream()` inside the POST action handler's `ReadableStream.start` function, emit a `start` SSE event, then pipe the agent's `fullStream` directly into the same response body.

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

### askUserTool Integration

Mastra's `askUserTool` uses a different suspension mechanism than `requireApproval`:

| Aspect            | `requireApproval`                | `askUserTool`                                                                      |
| ----------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| Stream chunk type | `tool-call-approval`             | `tool-call-suspended`                                                              |
| Resume method     | `approveToolCallGenerate`        | `resumeStream(resumeData, { runId })`                                              |

#### filterAndForward: handle both suspension types

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

#### Answer endpoint (resumeStream)

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

#### Client answer flow

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

### requireToolApproval Snapshot Loss

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

Suspect this issue when:
- Approval works on the first tool call but is silently bypassed on subsequent calls
- After approving/declining, the tool executes without the expected approval prompt
- The resumed run permits tool calls that were previously gated by `requireToolApproval`

### Key Differences from Two-Connection Pattern

| Aspect          | Two-connection                  | Single-request                 |
| --------------- | ------------------------------- | ------------------------------ |
| Requests        | POST (start) + GET (SSE stream) | One POST                       |
| Server state    | stream-store.ts with TTL        | None — consumed inline         |
| Client protocol | fetch + EventSource             | `fetch()` + reader             |
| Error handling  | JSON for errors, SSE for stream | SSE for everything             |
| Auth checks     | Separate check on each endpoint | Single check in action         |
| Orphan cleanup  | TTL timers, memory pressure     | Stream dies with request       |
| Proxy timeout   | SSE open indefinitely           | Same — open for agent duration |

---

## Part 3: Tool Result Extraction (Chunk vs Flat Format)

### Problem

After calling `agent.generate(message)`, you inspect `result.toolResults` and `result.toolCalls` to extract structured tool output — but the data isn't where you expect it.

The Mastra `FullOutput` type shows `ToolCallChunk[]` and `ToolResultChunk[]`, where each element has `{ type: 'tool-call', payload: { toolName, args, ... } }` or `{ type: 'tool-result', payload: { toolName, result, ... } }`. However, the **runtime** objects may use the chunk format (`result.toolCalls[i].payload.toolName`) OR a flat format (`result.toolCalls[i].toolName`) depending on the Mastra version and how the output was constructed.

Accessing `result.toolResults[i].result` directly fails silently (returns undefined) when the actual structure is `result.toolResults[i].payload.result`.

```typescript
// BROKEN: silently returns undefined when Mastra returns chunk format
let result = await agent.generate(message, opts)
for (let tr of result.toolResults ?? []) {
  console.log(tr.result) // undefined if structure is { payload: { result } }
}
```

### Solution

Always check BOTH formats by using a payload-first fallback pattern. **Iterate `toolResults` directly by `toolName`** instead of relying on same-index pairing with `toolCalls` — with multi-step agent responses (`maxSteps > 1`), the arrays may not align.

```typescript
let result = await agent.generate(message, opts)

// Handle both chunk format ({ payload: { toolName, ... } }) and flat format ({ toolName, ... })
// Iterate toolResults directly — more robust than index-based pairing with toolCalls
let toolResults = (result.toolResults ?? []) as unknown[]

for (let tr of toolResults) {
  let entry = tr as Record<string, unknown> | undefined
  // Prefer payload.toolName, fall back to direct toolName
  let payload = (entry?.payload as Record<string, unknown> | undefined) ?? entry
  if (payload?.toolName === 'my_tool' || payload?.toolName === 'my_tool_id') {
    // Prefer payload.result, fall back to direct result
    let toolResult = payload?.result as Record<string, unknown> | undefined
    // Use toolResult here
    console.log(toolResult)
  }
}
```

### Tool names: runtime uses the JavaScript property key, not `id`

At runtime in `@mastra/core@^1.49.0`, `toolName` is the **JavaScript object property key** (camelCase), NOT the `id` field you passed to `createTool()`.

```typescript
// Tool definition — property key is 'myTool', id is 'my_tool_id'
export const myTools = {
  myTool: createTool({ id: 'my_tool_id', ... })
}

// Runtime toolName is the property key, NOT the id
// result.toolResults[i].payload.toolName === 'myTool'  ← actual
// result.toolResults[i].payload.toolName === 'my_tool_id'  ← NOT this
```

This varies between Mastra versions. When in doubt, add a one-shot debug log to see the actual value:

```typescript
let result = await agent.generate(message, opts)
console.log(JSON.stringify(result.toolResults ?? []).slice(0, 1000))
// Look for "toolName": "..." in the output
```

Then use the exact string you see. A safe fallback checks both:

```typescript
if (
  payload?.toolName === 'find_next_available_slots' ||
  payload?.toolName === 'findNextAvailableSlots'
) {
  // either format works
}
```

### Exhaustive check — iterate toolResults directly

If you need the LAST matching tool result (useful when the agent makes multiple calls across steps), iterate `toolResults` directly:

```typescript
let lastResult: Record<string, unknown> | undefined
for (let tr of result.toolResults ?? []) {
  let entry = tr as Record<string, unknown> | undefined
  let payload = (entry?.payload as Record<string, unknown> | undefined) ?? entry
  if (payload?.toolName === 'myTool' || payload?.toolName === 'my_tool_id') {
    let trResult = payload?.result as Record<string, unknown> | undefined
    if (trResult != null) {
      lastResult = trResult // keep overwriting to get the most recent
    }
  }
}
```

This avoids index-based pairing fragility and handles multi-step agent responses correctly.

---

## Part 4: Message Content Normalization

### Problem

Mastra message `content` can be:

- **Plain string:** `"Hello world"`
- **Structured format v2:** `{ format: 2, parts: [{ type: 'text', text: 'Hello' }] }`
- **Object with `.text`:** `{ text: "Hello" }`
- **Array of mixed formats:** `["Hello", { text: "world" }]`

This happens silently when rendered directly: `String(content)` produces `[object Object]` instead of the actual text.

Without normalization, every consumer (chat UI, admin log viewer, audit export) must duplicate the extraction logic — and miss edge cases.

### Solution

Extract a shared `messageContentToText()` utility and apply it at the memory boundary so all consumers receive clean `content: string`.

**The utility** (`app/utils/message-content.ts`):

```ts
export function messageContentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    let obj = content as Record<string, unknown>
    if (obj.format === 2 && Array.isArray(obj.parts)) {
      return obj.parts
        .filter((p) => (p as Record<string, unknown>).type === 'text')
        .map((p) => (p as Record<string, unknown>).text as string)
        .join('\n')
    }
    if (typeof obj.text === 'string') return obj.text
  }
  if (Array.isArray(content)) {
    return content
      .map((c) => messageContentToText(c))
      .filter(Boolean)
      .join('\n')
  }
  return String(content ?? '')
}
```

**At the memory boundary** (e.g., `recall` wrapper):

```ts
let { messages } = await memory.recall({ threadId, perPage: false })
let chatMessages = (messages ?? [])
  .filter((m) => m.role === 'user' || m.role === 'assistant')
  .map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: messageContentToText(m.content),
    timestamp:
      typeof m.createdAt === 'string' ? new Date(m.createdAt).getTime() : Number(m.createdAt),
  }))
```

### What's happening inside Mastra

Mastra's internal `MastraDBMessage.content` uses the `MastraMessageContentV2` type:

```typescript
type MastraMessageContentV2 = {
  format: 2
  parts: Array<{
    type: 'text' | 'tool-call' | 'reasoning' | ...
    text?: string        // only on text parts
    args?: unknown       // on tool-call parts
    ...
  }>
  toolInvocations?: ...
  reasoning?: ...
}
```

The utility above extracts only `type: 'text'` parts — tool calls, reasoning blocks, and metadata are stripped, giving you clean conversation text.

### When to Use

- Any consumer of Mastra `memory.recall()` or `agent.generate()` output
- When building a chat UI, admin log viewer, or export tool that shows message content
- When the controller has duplicated content-extraction logic

---

## When to Use (Mastra Agent)

- Building a Mastra agent controller in Remix 3 with streaming SSE
- Adding `askUserTool` questions to an agent that already uses `requireApproval`
- Using function-based `requireToolApproval` with snapshot-resumed agents
- Replacing the two-connection POST + EventSource protocol
- Extracting structured output from `agent.generate()` tool calls
- Rendering Mastra message content anywhere (chat UI, logs, exports)

## Related Skills

- `mastra-tools` — approval gating, suspension detection, tool design patterns
- `mastra-workflow` — Mastra Workflow resume/abort race and step type compatibility
- `mastra-storage` — PostgresStore-backed observability and storage API usage
- `remix3-agent-routing` — agent-driven frame navigation and form prefill using the `navigate` event
- `remix-security-middleware` — CSRF bypass for SSE endpoints (`/mastra/chat`, `/route-agent`)
- `rate-limiter-pitfalls` — rate limiter configuration for multi-step agent flows
