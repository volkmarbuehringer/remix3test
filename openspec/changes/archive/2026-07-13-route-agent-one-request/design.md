## Context

The route agent currently uses a two-connection protocol: POST /route-agent starts the agent and returns a runId, then GET /stream/:runId opens an SSE connection to consume the agent's output stream. This requires an in-memory stream store (stream-store.ts) with TTL cleanup, ownership verification, and runId bookkeeping on both server and client.

For the answer flow (ask_user tool), the same pattern repeats: POST /answer returns a new runId, then a new SSE connection. For approve/decline, two nearly-identical endpoints exist.

The only clientEntry component (RouteAgentStream) manages: EventSource lifecycle, runId tracking, threadId tracking, 15+ SSE event types (most unused), manual frame navigation, and manual URL bar sync.

## Goals / Non-Goals

**Goals:**
- Single POST request for each agent interaction — stream consumed in the response
- Remove stream-store.ts and /stream/:runId entirely
- Consolidate approve/decline into one /tool-decision endpoint
- Reduce SSE event types forwarded to only what the UI consumes
- Add a typed `navigate` event so frame navigation + URL bar sync is explicit

**Non-Goals:**
- Changing the Mastra agent definition or tools
- Altering the route-agent page layout or Frame structure
- Adding new UI capabilities — only refactoring the transport layer
- Removing clientEntry entirely (streaming text still needs JS)

## Decisions

### Decision 1: Pipe agent stream directly into POST response body

**Instead of** storing the stream and returning runId for a separate SSE connection, the action handler writes each chunk to the response's writable stream as it arrives from the agent.

The response Content-Type remains `text/event-stream` so the client reads SSE-formatted chunks via `response.body.getReader()`. The structure is the same SSE format the client already expects — no protocol change for the client, just a different fetch pattern.

**Why this works:** The agent's `output.fullStream` is a ReadableStream. The action can create a TransformStream, pipe the agent stream through it, and return a Response with the readable side. No intermediary storage needed.

### Decision 2: Strip event forwarding to 4 UI-relevant types

The current fwd() function forwards 15+ Mastra chunk types: step-start, step-finish, reasoning-start/delta/end, text-start/end, tool-call-input-streaming-*, tool-call-delta, tool-call, abort, error, etc. The RouteAgentStream only handles: `message`, `tool-result`, `question`, `suspension`, `complete`, `error`.

Instead of blindly forwarding everything, filter to only the types the client actually acts on. This simplifies the SSE encoding logic and reduces wire traffic.

### Decision 3: Add explicit `navigate` SSE event for frame navigation

Currently, frame navigation is detected by inspecting `tool-result` events for `result.type === 'route'`. This is fragile — it couples the routing behavior to the structure of a tool result.

Instead, the route-navigate tool on the agent side should emit a Mastra event that the route agent controller translates to a dedicated `navigate` SSE event:

```
event: navigate
data: {"href":"/lists?ids=5","target":"lists-content","history":"push"}
```

The clientEntry handles this event by setting frame.src, calling frame.reload(), and updating window.history. This makes navigation intent explicit in the protocol rather than inferred.

### Decision 4: Consolidate approve/decline into /tool-decision

Both endpoints share identical structure: read runId + toolCallId from form data, call agent.approveToolCallGenerate or agent.declineToolCallGenerate, handle suspension, handle completion. The only difference is which agent method is called.

A single POST /tool-decision with a `decision: 'approve' | 'decline'` form field eliminates the duplication. The stream response works the same way — pipe agent output directly into the response.

## Risks / Trade-offs

- **[Connection timeout]** The POST request stays open for the full duration of agent processing. Long-running agent steps could hit proxy/load-balancer timeouts. Mitigation: Ensure the existing rate limiter keeps sessions short; add 30s keep-alive pings if needed.
- **[No retry on disconnect]** Unlike the two-connection approach where SSE automatically retries, a dropped POST response means the user must resubmit. Mitigation: acceptable for an internal admin tool; the current approach has the same problem (stream-store TTL).
- **[Approval/answer re-request]** The answer and tool-decision flows start new POST requests. If the user has answered a question but the POST drops, they must answer again. Mitigation: same as current behavior (the answer/create/approve endpoints already require a new request).

## Open Questions

- Should we add keep-alive heartbeat events to prevent proxy timeouts during long agent thinking?
- Does the `navigate` event need a `replace` history mode option (for cases where back should skip the agent page)?
