## Context

The workflow-agent SSE pipeline in `app/utils/agent-sse.ts` transforms Mastra agent `fullStream` chunks into SSE events sent to the client. The `filterAndForward` function dispatches based on `chunk.type` — it handles `text-delta`, `tool-call-approval`, `tool-call-suspended`, `finish`, `tool-result`, `tool-error`, and `error`.

The client-side `workflow-agent-stream.tsx` processes these events. The "Bestätigen" button is rendered from a `question` SSE event (originating from `tool-call-suspended`). If no `question` event is emitted, the button never appears.

## Goals / Non-Goals

**Goals:**
- Log every SSE event type that `filterAndForward` sends to the client
- Log the full payload when a `question` event is emitted (question text, options count, selectionMode)
- Enable reproduction of the bug to see which events are/aren't sent

**Non-Goals:**
- No client-side logging
- No permanent instrumentation
- No change to application behavior

## Decisions

- **Add log inside `fwd()` function** — catches all events at the single chokepoint (line 39). Logs `[SSE] fwd: <type>`.
- **Add log inside `tool-call-suspended` handler** — logs `[SSE] QUESTION: <question text>, options: <count>, mode: <mode>` at line 59-66
- **Removal in a second commit after diagnosis** — logs are temporary

## Risks / Trade-offs

- `console.log` is visible in production logs — acceptable since this is a diagnostic pass and will be removed
- Log volume is low (one line per SSE event, typically <20 events per agent interaction)
