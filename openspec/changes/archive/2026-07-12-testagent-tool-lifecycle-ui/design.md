## Context

The test agent (`/testagent`) uses Mastra's `agent.stream()` which returns a `fullStream` (ReadableStream) emitting typed chunks (`ChunkType`). The controller reads this stream and translates chunks to Server-Sent Events (SSE) for the browser client. Currently only 4 chunk types are forwarded: `text-delta` → `message`, `tool-call-approval` → `suspension`, `tool-call-suspended` → `question`, and `finish` → `complete`. The remaining ~12 chunk types (tool-call, tool-result, tool-error, step-start, step-finish, reasoning-_, tool-call-delta, tool-call-input-streaming-_, text-start/end, start) are silently dropped.

The client-side `TestAgentStream` component (`app/assets/test-agent-stream.tsx`) is a Remix 3 `clientEntry` that attaches SSE event listeners in a `ref` callback. It currently handles 6 SSE event types.

## Goals / Non-Goals

**Goals:**

- Forward every native Mastra stream chunk type as an identically-named SSE event from the controller
- Render tool lifecycle information in the test agent UI: tool calls, arguments, results, errors, step stats
- Show reasoning chain-of-thought when the model emits it (expandable)
- Show token usage per step
- All data must come from existing stream chunks — no changes to agent definition or tools

**Non-Goals:**

- No `beforeToolCall`/`afterToolCall` hooks (they're side-effect callbacks, not stream-injectable — separate concern)
- No `context.writer` custom chunks in `listTestTools` (execute-phase progress is additive, not required for this change)
- No changes to `test-agent.ts`, `test-tools.ts`, or workspace tool config
- No database schema changes

## Design

### Data Flow

```
Mastra agent.stream()
  → fullStream (ReadableStream of ChunkType)
    → controller.tsx SSE reader (for...await loop)
      → translates each chunk.type → SSE event with same name
        → TestAgentStream clientEntry (EventSource listeners)
          → renders into DOM containers
```

### Controller Changes (controller.tsx)

The stream reader loop at lines 147-218 currently has a `switch`-like `if/else if` chain. The approach is to replace it with a generic dispatch that forwards every chunk type:

```
for each chunk in fullStream:
  type = chunk.type
  payload = structured subset of chunk.payload (strip large internal fields, forward display-relevant data)
  enqueue: `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
```

Special cases that need transforms (not raw forwarding):

- `tool-call-approval` → `suspension` event (already done — keeps existing behavior)
- `tool-call-suspended` → `question` event if question payload exists (already done)
- `tool-result.payload.result` may need truncation if very large
- `finish.payload` contains `messages` which should be excluded (too large, not needed by client)

Everything else: forward with the chunk type as the SSE event name. This keeps the client and server aligned without translation mappings.

### Client Changes (test-agent-stream.tsx)

The client registers SSE event listeners via `es.addEventListener(type, handler)`. Currently 6 handlers. Add handlers for:

**Tool lifecycle events:**

- `tool-call-input-streaming-start` → create a tool card element, show tool name
- `tool-call-delta` → append argsTextDelta to a growing partial-JSON display
- `tool-call-input-streaming-end` → finalize the partial args display
- `tool-call` → replace partial args with complete formatted args object
- `tool-result` → append result summary to tool card (file count, sizes, or error)
- `tool-error` → show error state on tool card

**Step events:**

- `step-start` → optional step marker (can be subtle)
- `step-finish` → append token usage badge to the last tool card or as a separate line

**Reasoning events (if model emits them):**

- `reasoning-start/delta/end` → accumulate reasoning text into an expandable details element

**Text and stream events:**

- `text-start`/`text-end` → bookend the message bubble (minor — text-delta already works)
- `start` → clear previous state, show "agent starting..."
- `error` → show error state
- `abort` → show aborted state

### UI Structure

Each interaction produces vertically-stacked timeline cards:

```
┌─ Agent started ──────────────────────────┐
│  runId: abc-123                           │
├─ 💭 Reasoning ───────────────────────────┤  ← expandable <details>
│  The user wants to know what files exist  │
│  in the app directory...                  │
├─ 🔧 Tool: listTestFiles ────────────────┤  ← collapsible card
│  Arguments (live):                        │
│    subdir: "app"                          │
│    ext: ".ts"                             │
│    recursive: true                        │
│  Result: 5 files found                    │
│    routes.ts      8.69 KiB               │
│    router.ts      4.41 KiB               │
│    ...                                   │
│  ⚡ 201 tokens (156→45)                  │
├─ 💬 Assistant ───────────────────────────┤
│  Here are the TypeScript files in app/... │
│                                           │
└───────────────────────────────────────────┘
```

New DOM containers needed in `test-agent-page.tsx`:

- `<div id="test-agent-timeline">` — container for the timeline

The existing `test-messages` div can be replaced or complemented by the timeline. The form and approval/question cards stay unchanged.

### Chunk Payload Truncation Rules

Some `fullStream` chunks carry large payloads not suitable for SSE forwarding:

| Chunk             | Forward                                         | Truncate                                                                  |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `tool-result`     | `{ toolName, toolCallId, result, isError }`     | `result` — if file list > 20 entries, truncate and add `_truncated: true` |
| `tool-call`       | `{ toolName, toolCallId, args }`                | None — args are small                                                     |
| `finish`          | `{ stepResult: { reason }, output: { usage } }` | Strip `messages`, `response`                                              |
| `step-finish`     | `{ stepResult: { reason }, output: { usage } }` | Same as finish                                                            |
| `tool-call-delta` | `{ toolName, toolCallId, argsTextDelta }`       | None                                                                      |
| `error`           | `{ error }`                                     | None — include full error message                                         |

## Decisions

1. **Forward chunk type as SSE event name (no mapping table)**
   - Alternative: maintain a mapping table of chunk types → SSE event names
   - Decision: use `chunk.type` directly as the SSE event name. This eliminates a translation layer, makes the controller a transparent bridge, and keeps client and server aligned with Mastra's documented ChunkType enum. The three existing special cases (approval, suspension, finish) are kept as-is for backward compatibility with the existing client handler code.

2. **Client-side accumulation of partial JSON (tool-call-delta)**
   - Alternative: accumulate on the server and emit the complete JSON once
   - Decision: send each delta chunk to the client and accumulate there. This lets the UI show args "streaming in" in real time, which is the whole point. A simple `acc += argsTextDelta` with `try/catch JSON.parse` on each accumulation is sufficient.

3. **New DOM elements vs modifying Replicache/state management**
   - Decision: add static DOM containers and manipulate via `document.getElementById` (same pattern as existing code). The test agent doesn't use a reactive framework — it's all imperative DOM manipulation in a `clientEntry`. This keeps the change consistent with the existing architecture.

4. **Single timeline container vs per-section containers**
   - Decision: a single `test-agent-timeline` div. Each event inserts a card. This gives a natural chronological scroll that includes tool calls interleaved with messages.

## Risks / Trade-offs

- [Large tool results] → `listTestFiles` can return up to 100 entries. Truncate to 20 in the SSE event, show "and N more" link. The full data is already in the agent's context.
- [SSE connection overhead] → Each `tool-call-delta` chunk becomes an SSE event. For a tool with complex args, this could be ~10-20 events in rapid succession. SSE is designed for this, but verify browser EventSource handles high-frequency events gracefully.
- [Reasoning chunks are model-dependent] → Not all models emit reasoning chunks. The client should handle their absence gracefully (no broken UI).
- [Backward compatibility] → Adding new SSE event types doesn't break existing handlers. Old handlers ignore unknown event types. New handlers only fire when the server sends them.
