## Why

The current workflow agent at `/workflow-agent` uses a two-phase architecture: an external agent generates JSON, then the controller parses it in a hard-coded switch statement to decide what to do. This has three limitations:

1. **Flow is implicit** — the decision logic lives inside `controller.tsx` as if/else branches, not in a visible structure
2. **Adding new actions requires touching the switch** — every new type of action means editing the controller's dispatch logic
3. **Single agent call** — the agent resolves intent in one shot, with no opportunity for mid-flow reasoning or incremental context gathering

The event pipeline architecture (`/workflowagent2`) makes the flow explicit, composable, and observable by modeling each processing stage as a typed event handler on a bus. The agent becomes one handler among many, not the sole decision-maker.

This is an **architectural experiment** — no real functionality is built. The route is a skeleton demonstrating the event-driven pattern for the same admin-input → resolve → execute problem domain.

## What Changes

- New route `/workflowagent2` with skeleton event pipeline:
  - `validate` — code handler, parses and validates the input message
  - `classify` — agent handler, resolves natural language intent
  - `resolve` — code handler, looks up referenced entities (users, resources)
  - `dispatch` — code handler, routes the resolved intent to an action
  - `confirm` — code handler, emits a confirm event requiring admin approval
  - `execute` — code handler, starts a sub-workflow or emits a navigate/message event
  - `finalize` — code handler, logs and completes
- Event bus that routes typed events through registered handlers in order
- Controller that pipes each emitted event to SSE
- Existing files, routes, and workflows untouched

## Capabilities

### New Capabilities

- `event-pipeline`: A typed event bus that accepts events, routes them through registered handlers, and emits resulting events. Each handler subscribes to one event type and emits zero or more events downstream.
- `agent-handler`: A handler that wraps a Mastra agent call, accepting structured event data and emitting a classified event. Demonstrates agent-as-handler pattern.
- `confirm-handler`: A handler that suspends the pipeline for admin approval via SSE. Demonstrates the confirm-gate pattern in an event-driven model.
- `sse-stream`: Each emitted event in the pipeline is streamed to the client as SSE, making the full flow observable end-to-end.

### Modified Capabilities

- None — existing routes and agents are unchanged.

## Impact

- **New files** under `app/actions/agent-events/`: `controller.tsx`, `event-bus.ts`, `handlers/` directory with handler stubs, `register.ts`
- **New file**: `app/ui/agent-events-page.tsx` — UI layout (copied from workflow-agent-page, points to new route)
- **Modified**: `app/routes.ts` — add route definition
- **Modified**: `app/route-labels.ts` — add label
- **Modified**: `app/router.ts` — register route
- **No changes** to existing controllers, agents, workflows, or Mastra config
