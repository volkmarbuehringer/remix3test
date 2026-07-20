## Why

The workflow-agent route navigates to `/admin/users` but the "Bestätigen" (confirm) button click produces no visible result — no console output, no server activity, and the agent doesn't continue. The SSE event pipeline between the Mastra agent's `fullStream` and the client needs diagnostic logging to pinpoint where the chain breaks.

## What Changes

- Add `console.log` in `app/utils/agent-sse.ts` (`filterAndForward`) logging every SSE event type sent to the client
- Add `console.log` in `app/utils/agent-sse.ts` when a `question` event is emitted (log question text, options count, selectionMode)
- After observing the logs during reproduction, remove the diagnostic logging

## Capabilities

### New Capabilities
- `sse-diagnostics`: Temporary diagnostic logging for the agent SSE pipeline — logs every `filterAndForward` event type and `question` event payload to the server console

### Modified Capabilities
*(none)*

## Impact

- `app/utils/agent-sse.ts` — two `console.log` lines added, removed after diagnosis
- No functional change to application behavior
