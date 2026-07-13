---
name: mastra-askusertool-stream-integration
description: "Wire Mastra's askUserTool into a Remix 3 streaming controller — SSE event mapping, answer endpoint, and question card rendering"
origin: auto-extracted
---

# Mastra askUserTool Integration for Remix 3 Streaming Controllers

**Extracted:** 2026-07-12 (updated 2026-07-13 for single-request streaming)
**Context:** Remix 3 app with Mastra agent streaming via SSE. Adding `askUserTool` to an agent that already uses `requireApproval` for workspace tools.

## Problem

Mastra's `askUserTool` (from `@mastra/core/tools`) lets an agent suspend mid-turn and ask the user a structured question. But it uses a different suspension mechanism than `requireApproval`:

| Aspect | `requireApproval` | `askUserTool` |
|--------|------------------|---------------|
| Stream chunk type | `tool-call-approval` | `tool-call-suspended` |
| Payload shape | `{ toolCallId, toolName, args }` | `{ toolCallId, toolName, suspendPayload: { question, options?, selectionMode? } }` |
| Resume method | `approveToolCallGenerate` | `resumeStream(resumeData, { runId })` |
| Resume data | binary approve/decline | `string` or `string[]` |

The SSE handler in a Remix 3 controller needs to handle both chunk types differently. The `answer` endpoint must call `resumeStream` not `approveToolCallGenerate`.

## Solution

### 1. Add askUserTool to the agent

```typescript
import { askUserTool } from '@mastra/core/tools'

// In the Agent constructor:
tools: { listTestFiles, askUserTool },
```

No type cast needed — `tsc` accepts it directly.

### 2. Handle `tool-call-suspended` in the stream reader (single-request pattern)

The single-request pattern pipes `agent.stream()` into a `filterAndForward()` function inside `pipeStream()`. The `tool-call-suspended` branch emits a `question` SSE event and returns `'suspended'` to signal the loop to stop:

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

  // ...
  if (type === 'tool-call-approval') {
    fwd('suspension', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
    })
  } else if (type === 'tool-call-suspended') {
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
    return 'suspended'  // signals pipeStream to close the loop
  }
  // ...
}
```

`pipeStream` reads the return value and short-circuits:

```typescript
let result = filterAndForward(chunk, controller, runId)
if (result === 'suspended') {
  reader?.cancel().catch(() => {})
  closeOnce()
  return  // stream paused — client will POST answer
}
```

Important: short-circuit the read loop after emitting `question` — the stream is paused, not finished.

### 3. Build the answer resume endpoint (single-request pattern)

The answer handler uses the same single-request pattern: call `resumeStream` inside `ReadableStream.start`, emit a `start` event, then pipe the result:

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
  if (answerRaw.length > MAX_MESSAGE_LENGTH) {
    return new Response(
      sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Answer too long' })}\n\n`),
      { status: 400, headers: sseHeaders() },
    )
  }

  // Parse multi-select JSON arrays. Only parse when selectionMode confirms it.
  let resumeData: unknown = answerRaw
  if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
    try { resumeData = JSON.parse(answerRaw) } catch { /* keep as string */ }
  }

  let body = new ReadableStream({
    start: async (controller) => {
      try {
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

The `sseHeaders()` helper:

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

### 4. Render the question card client-side

Three modes based on `selectionMode`:

- **No options** → free-text `<input type="text">`
- `'single_select'` or omitted → radio buttons with first option checked
- `'multi_select'` → checkboxes

Use `textContent` not `innerHTML` for the question text (the model controls it). Use `esc()` on option labels since they're rendered into HTML attributes.

### 5. Client-side answer flow

The client POSTs to the answer endpoint with `selectionMode` so the server can correctly parse multi-select answers. The response is a stream (same single-request pattern), so the client calls `startStream()` which uses `fetch()` + `response.body.getReader()`:

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

Only hide the question card and clear `pendingQuestion` **after** `startStream` begins — otherwise a network error permanently strands the suspended agent run.

## When to Use

- Adding `askUserTool` to a Mastra agent in a Remix 3 streaming controller
- Distinguishing between `requireApproval` and `tool-call-suspended` chunk types
- Building an answer endpoint that resumes with `resumeStream`
- Handling multi-select answers through FormData (string-only transport)

## Key Differences from requireApproval

| | requireApproval | askUserTool |
|---|---|---|
| Chunk | `tool-call-approval` | `tool-call-suspended` |
| Resume | `approveToolCallGenerate({ runId, toolCallId })` | `resumeStream(resumeData, { runId, toolCallId })` |
| Client sends | nothing extra | `answer` + `selectionMode` fields |
| Data direction | binary (approve/decline) | user-provided string or string[] |
