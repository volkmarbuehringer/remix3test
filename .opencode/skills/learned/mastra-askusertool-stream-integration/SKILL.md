---
name: mastra-askusertool-stream-integration
description: "Wire Mastra's askUserTool into a Remix 3 streaming controller — SSE event mapping, answer endpoint, and question card rendering"
origin: auto-extracted
---

# Mastra askUserTool Integration for Remix 3 Streaming Controllers

**Extracted:** 2026-07-12
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

### 2. Handle `tool-call-suspended` in the SSE stream reader

In the stream handler, add a branch after the existing `tool-call-approval` branch:

```typescript
} else if (chunk.type === 'tool-call-suspended') {
  let p = chunk.payload as Record<string, unknown> | undefined
  let sp = p?.suspendPayload as
    | { question?: string; options?: { label: string; description?: string }[]; selectionMode?: string }
    | undefined
  if (sp?.question) {
    controller.enqueue(
      sseEncoder.encode(
        `event: question\ndata: ${JSON.stringify({
          runId: stored.runId,
          toolCallId: p?.toolCallId,
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        })}\n\n`,
      ),
    )
  }
  closeOnce()
  reader?.cancel().catch(() => {})
  return
}
```

Important: short-circuit the read loop after emitting `question` — the stream is paused, not finished.

### 3. Build the answer resume endpoint

```typescript
async answer(context) {
  let runId = context.formData.get('runId')?.toString()
  let answerRaw = context.formData.get('answer')?.toString()
  let toolCallId = context.formData.get('toolCallId')?.toString() || undefined
  let selectionMode = context.formData.get('selectionMode')?.toString()

  if (!runId || !answerRaw) {
    return context.json({ error: 'Missing runId or answer' }, { status: 400 })
  }
  if (answerRaw.length > MAX_MESSAGE_LENGTH) {
    return context.json({ error: 'Answer too long' }, { status: 400 })
  }

  // Parse multi-select JSON arrays. Only parse when selectionMode confirms it.
  let resumeData: unknown = answerRaw
  if (selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
    try {
      resumeData = JSON.parse(answerRaw)
    } catch {
      /* keep as string */
    }
  }

  let output = await agent.resumeStream(resumeData, { runId, toolCallId })
  setStream(output.runId, { ... })
  return context.json({ runId: output.runId })
}
```

### 4. Render the question card client-side

Three modes based on `selectionMode`:

- **No options** → free-text `<input type="text">`
- `'single_select'` or omitted → radio buttons with first option checked
- `'multi_select'` → checkboxes

Use `textContent` not `innerHTML` for the question text (the model controls it). Use `esc()` on option labels since they're rendered into HTML attributes.

### 5. Client-side answer flow

The client POSTs to the answer endpoint with `selectionMode` so the server can correctly parse multi-select answers:

```typescript
let body = new FormData()
body.set('runId', pendingQuestion.runId)
body.set('answer', answer)
body.set('selectionMode', pendingQuestion.selectionMode)
if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)

let res = await fetch('/testagent/answer', { method: 'POST', body })
```

Only hide the question card and clear `pendingQuestion` **after** the fetch succeeds — otherwise a network error permanently strands the suspended agent run.

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
