## 1. Controller refactor — single-stream action

- [x] 1.1 Refactor the `action` handler to pipe `output.fullStream` into the response body as a new ReadableStream instead of storing it via `setStream()`
- [x] 1.2 Set response Content-Type to `text/event-stream` and appropriate headers (no-cache, keep-alive, X-Accel-Buffering) in the action handler
- [x] 1.3 Handle request abort signal — cancel the agent stream reader when the client disconnects
- [x] 1.4 Remove the `stream` action handler and the `/stream/:runId` route from both controller and routes.ts
- [~] 1.5 Remove stream-store.ts imports from route agent controller (file kept — other controllers still use it)

## 2. SSE event cleanup

- [x] 2.1 Replace the 15-way if/else fwd() block with a filtered forwarder that only emits event types the UI consumes (message, tool-result, question, suspension, complete, error)
- [x] 2.2 Add explicit `navigate` event type: when tool-result has type `route`, emit a `navigate` event with `{ href, target, history }` instead

## 3. Consolidate approve/decline

- [x] 3.1 Merge approve + decline handlers into a single `toolDecision` handler that reads `decision: 'approve' | 'decline'` from form data
- [x] 3.2 Update the `toolDecision` handler to pipe agent output into the response (same pattern as main action) — remove `completedStream()` helper
- [x] 3.3 Replace `/approve` and `/decline` routes with a single `/tool-decision` POST route in routes.ts
- [x] 3.4 Update the answer handler to stream in the response instead of returning JSON

## 4. ClientEntry update

- [x] 4.1 Replace EventSource with `fetch()` + `response.body.getReader()` in RouteAgentStream
- [x] 4.2 Remove runId bookkeeping — the stream comes from the POST response directly
- [x] 4.3 Remove EventSource lifecycle management (close, reconnect, error handling)
- [x] 4.4 Wire the reader loop to the same event parsing logic (message → show text, navigate → frame nav + URL sync, question → show question, etc.)
- [x] 4.5 Update the SSE event reading to handle the `navigate` event: set frame.src, call frame.reload(), call history.pushState/replaceState

## 5. Cleanup and verification

- [x] 5.1 Remove unused imports from controller.tsx and route-agent-stream.tsx
- [x] 5.2 Run `npm run typecheck` and fix any type errors
- [x] 5.3 Run `npm test` and verify existing tests pass
- [x] 5.4 Manual test: send message to route agent, verify streaming text appears in the bar
- [x] 5.5 Manual test: ask agent to navigate, verify frame reloads and URL bar updates
- [x] 5.6 Manual test: ask agent a question, answer it, verify conversation continues
