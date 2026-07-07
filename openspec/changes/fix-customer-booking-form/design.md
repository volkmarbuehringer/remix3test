## Context

The customer agent chat follows this flow:

```
User sends message → agent.generate() → tool results returned → controller iterates toolCalls/toolResults
  → finds find_next_available_slots → extracts slot data → session.set('pendingBooking', ...)
  → redirect to GET /chat → controller reads session → renders CustomerChatPage with pendingBooking → form shows
```

The booking form never appears. The most likely root cause is in the tool-result parsing at `controller.tsx:326-348`. The code matches `toolCalls[i]` to `toolResults[i]` by index and checks for `toolName === 'find_next_available_slots'`, then extracts `.result` from the matching tool result. If the AI SDK's multi-step `generateText()` collates tool calls/results differently than expected — or if the agent calls the tool across multiple steps — the index-based matching may miss the result.

Secondary possibility: the agent isn't calling the tool at all (text-only response).

## Goals / Non-Goals

**Goals:**
- Make the booking form appear when `find_next_available_slots` returns non-empty slots
- Add a test that verifies the full parsing pipeline with mock agent returning real tool result shapes
- Handle the case where the agent calls tools across multiple steps

**Non-Goals:**
- No UI changes to the booking form itself
- No changes to the agent's prompt or tool definitions
- No changes to the booking workflow or appointment creation

## Decisions

1. **Fix index-based matching → use toolCallId pairing instead**
   The current code assumes `toolCalls[i]` matches `toolResults[i]`. With `maxSteps: 5`, the AI SDK may return results in a different order or grouping. Instead, iterate `toolResults` directly and match by `toolName` — the result object already carries both the tool name and the result payload.

2. **Log the raw tool result shape when in dev/test mode**
   Add a debug log to `console.error` (already used in this controller for errors) that dumps the tool result structure so we can see exactly what the AI SDK returns at runtime. This is temporary — will be removed once the fix is verified.

3. **Test with a mock agent that returns real tool result shapes**
   The existing mock returns `{ text: "..." }` only. The new test will use a mock that returns `{ text, toolCalls, toolResults }` with the actual structure the AI SDK produces.

## Risks / Trade-offs

- **[Risk] Matching by `toolName` on `toolResults` could match a stale result from an earlier step** → The controller only processes the current `generate()` call's results, so this isn't possible. Each call is stateless.
- **[Risk] The actual AI SDK result structure may differ from what we infer from types** → The debug log mitigates this. We'll see the real shape and can adjust.
- **[Risk] Fixing the parsing but the agent still doesn't call the tool** → Out of scope for this change. The agent prompt is already correct. If it's a model behavior issue, it needs separate investigation.
