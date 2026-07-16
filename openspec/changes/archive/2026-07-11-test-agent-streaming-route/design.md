## Context

The app currently uses `agent.generate()` in its Mastra chat controllers, blocking the HTTP request for 30-60s. An SSE streaming pattern was identified as the correct approach for delivering incremental agent output. A proof-of-concept `/testagent` route will validate the POST-then-SSE architecture with a simple file-listing agent, including the tool-call approval suspend/resume cycle, before porting to production routes.

## Goals / Non-Goals

**Goals:**

- New top-level `/testagent` route with no auth
- Mastra `testAgent` with `list_test_files` (no approval) and `read_test_file` (requires approval)
- SSE streaming of agent tokens from `agent.stream().textStream`
- clientEntry-based chat UI that manages the multi-phase lifecycle (submit → stream → approval → reconnect → stream)
- In-memory stream store bridging POST action → GET SSE endpoint
- All new code follows existing patterns (createTool, createController, clientEntry)

**Non-Goals:**

- No changes to production agents (supportAgent, customerAgent)
- No database schema changes
- No auth middleware (test route is open)
- No memory/thread persistence
- Not a production-ready chat — a prototype

## Decisions

### Decision: In-memory Map as stream store

A simple `Map<runId, MastraModelOutput>` in a shared module. The POST action stores the output, the SSE handler retrieves and deletes it (one-consumer semantics). TTL cleanup via `setTimeout` prevents leaks if the client disconnects before reading. This avoids adding a dependency (Redis, DB) for a prototype.

### Decision: No Memory config on testAgent

The test agent is stateless — no `Memory`, no thread persistence. Each message is a fresh conversation. This keeps the prototype simple and avoids coupling to the database-backed storage that production agents use.

### Decision: Multi-phase SSE per approval

Each `agent.stream()` call produces one `MastraModelOutput` with its own `runId`. When the stream suspends (tool approval), the SSE endpoint sends a `suspension` event and closes. The client POSTs to the approve/decline action, which calls `agent.approveToolCallGenerate()`, producing a new output. The client opens a new SSE to the new `runId`. This maps cleanly to the existing `approve`/`decline` action pattern.

### Decision: clientEntry manages the full lifecycle

A single `clientEntry` in the test chat page:

1. Intercepts form submit via `fetch` POST
2. Opens `EventSource` to the SSE endpoint
3. Appends token text to a DOM container
4. On `suspension` event, renders an approval card with tool details
5. On approval/decline button click, POSTs to the approve/decline action, opens new SSE
6. On `complete` event, closes stream and shows final state

Alternative considered: Using two separate forms (one for message, one for approval). Rejected because the clientEntry approach gives us a single, cohesive UX (streaming text + inline approval buttons) inside a single page. The forms approach would cause page reloads on every action.

### Decision: Tool-approval payload includes tool name and args

The suspension payload from Mastra's `approveToolCallGenerate` includes `toolCallId`, `toolName`, and `args`. The SSE suspension event sends these to the client so the approval card can show "Allow reading package.json?" instead of a generic prompt.

## Risks / Trade-offs

- **Stream store race**: If the SSE endpoint is requested before the POST finishes storing the output, it returns 404. Mitigation: the POST returns the `runId` only after the stream is stored. The client opens SSE after receiving the POST response.
- **Memory leak from disconnected clients**: The `MastraModelOutput` stays in memory if the client never opens the SSE. Mitigation: `setTimeout` cleanup with a 5-minute TTL per entry.
- **SSE suspension event format**: The `fullStream` emits suspension chunks that are not visible on `textStream`. Mitigation: use `fullStream` reader instead of `textStream`, filtering for relevant chunk types (text → `message` event, tool-call suspension → `suspension` event).
- **No auth on test route**: This is intentional for prototyping. Production routes will reuse this pattern with `requireAuth` middleware.
