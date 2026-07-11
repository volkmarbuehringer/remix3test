## Why

The existing Mastra chat routes use synchronous `agent.generate()`, blocking the request for 30-60s with no user feedback. A dedicated test route is needed to prototype and validate an SSE-based streaming architecture (POST-then-SSE pattern) before porting it to the production support/customer agents. The test agent also needs a file-listing tool with an approval gate for content reads, proving the suspension/reconnect cycle works end-to-end.

## What Changes

- New route `/testagent` at top level (not under admin, no auth required)
- New Mastra agent `testAgent` with two tools:
  - `list_test_files` — lists directory contents (names only), no approval needed
  - `read_test_file` — reads file content, requires tool-call approval
- New controller `test-agent/controller.tsx` with three actions:
  - `index` (GET) — renders test chat page
  - `action` (POST) — validates message, calls `agent.stream()`, returns `{ runId }`
  - `stream` (GET /testagent/stream/:runId) — SSE endpoint that pipes `textStream` chunks
- New UI page `test-agent-page.tsx` with a `clientEntry` that:
  - intercepts form submit via fetch
  - opens `EventSource` to the SSE endpoint
  - renders tokens as they arrive
  - shows approval card for `read_test_file` suspensions
  - POSTs to approve/decline, then opens a new SSE connection for the continuation
- In-memory `StreamStore` (`Map<runId, MastraModelOutput>`) to bridge POST → SSE
- Tool-call approval flow: suspension → SSE closure → approval POST → new SSE for result

## Capabilities

### New Capabilities

- `agent-streaming-sse`: SSE-based streaming transport for Mastra agent responses, supporting multi-phase execution across tool-call approval boundaries
- `test-agent-route`: The `/testagent` route, agent definition, tools, controller, and chat UI

### Modified Capabilities

- `sse-infrastructure`: Extends the existing SSE patterns with a run-scoped stream store for bridging POST-invoked agent streams to GET SSE endpoints

## Impact

- New files in `app/actions/test-agent/`, `app/ui/`, `app/actions/mastra/agents/`, `app/actions/mastra/tools/`
- Minor additions to `app/routes.ts` and `app/router.ts`
- New helper `app/utils/stream-store.ts`
- No changes to production agents, existing chat routes, or database schema
