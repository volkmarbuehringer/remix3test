## Why

The route agent uses a two-connection protocol (POST to kick off agent processing, then SSE to consume the stream) bridged through an in-memory stream-store. This adds unnecessary complexity: stream-store.ts with TTL cleanup, a separate /stream/:runId route with duplicate auth checks, runId bookkeeping on the client, and EventSource lifecycle management. For an agent whose primary output is often a navigation instruction, the extra round-trip and state management provide no benefit — the stream can be consumed directly in the POST response.

## What Changes

- Replace the two-connection POST+SSE protocol with a single POST response that streams agent output directly
- Remove stream-store.ts and the /stream/:runId endpoint
- Consolidate approve/decline into a single /tool-decision endpoint
- Strip SSE event forwarding to only the 4 event types the UI actually consumes (message, tool-result, question, complete)
- Add a typed `navigate` SSE event for frame navigation + URL bar sync
- Update the clientEntry RouteAgentStream to use fetch() + response.body.getReader() instead of EventSource
- Update the answer flow to POST and stream in one request

## Capabilities

### New Capabilities

- `one-request-agent-streaming`: Single-request protocol for streaming agent output where the POST handler pipes the Mastra agent stream directly into the response body.

### Modified Capabilities

None — this is a purely internal architecture change. No spec-level behavior changes.

## Impact

- **Removed files**: `app/utils/stream-store.ts`
- **Modified files**: `app/actions/route-agent/controller.tsx`, `app/assets/route-agent-stream.tsx`, `app/routes.ts`
- **Reduced endpoints**: /stream/:runId removed, approve+decline merged into /tool-decision
- **Client protocol**: EventSource → `fetch()` + `response.body.getReader()`
- **No external API changes**: only internal route agent UI
