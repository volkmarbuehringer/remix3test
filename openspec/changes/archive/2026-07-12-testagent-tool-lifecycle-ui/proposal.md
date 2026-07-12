## Why

The test agent is a diagnostic tool for exploring the codebase via an AI agent, but its UI is opaque — users see only the final text response with no visibility into what the agent is doing (which tools it calls, what arguments it passes, what results it gets, how many tokens it uses). Mastra's stream already emits this information as structured chunks, but the controller drops ~12 chunk types before they reach the client. Surfacing this data turns the test agent from a black-box chat into a transparent debugging tool.

## What Changes

- Forward all native Mastra stream chunk types from the controller's SSE reader to the client as SSE events (currently only 4 of ~16 chunk types are forwarded)
- Add client-side rendering of tool lifecycle: tool call start, arguments streaming in real time, complete args, result summary, errors, step stats (token usage, finish reason)
- Add reasoning display (if model supports it) as expandable chain-of-thought
- No changes to agent definition, tool implementation, or workspace config — all data already exists in `fullStream`

## Capabilities

### New Capabilities
- `tool-lifecycle-visibility`: forward all Mastra stream chunk types as SSE events and render them in the test agent UI as structured, collapsible tool lifecycle cards

### Modified Capabilities
<!-- No existing specs change — this is a new feature in the test agent -->

## Impact

- `app/actions/test-agent/controller.tsx`: SSE stream reader (add ~10 `else if` branches for chunk types)
- `app/assets/test-agent-stream.tsx`: Client-side SSE event handlers (add ~10 new event listeners + rendering logic)
- `app/ui/test-agent-page.tsx`: New container elements for tool cards, reasoning, step stats
- No changes to `app/actions/mastra/agents/test-agent.ts`, `app/actions/mastra/tools/test-tools.ts`, or workspace config
