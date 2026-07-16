## Why

The route-agent can navigate to pages and search lists, but it has no visibility into form submissions. When a user fills and submits a form (e.g., creating a resource), the agent's stream is disconnected from the result. This experiment bridges that gap: make the form controller agent-aware so the agent can see structured form results and continue the conversation based on what was submitted.

## What Changes

- Add an agent-aware response path to the `verwaltung/resources` create controller that returns JSON instead of HTML redirect when an `X-Agent-Thread` header is present
- Update the client-side frame form intercept (`handleFrameFormSubmit`) to sniff JSON responses and forward them to the agent via `/route-agent/answer`
- Add instructions to the route-agent so it can participate in form-driven workflows

## Capabilities

### New Capabilities

- `agent-aware-form-controller`: Makes existing HTML form controllers respond with structured JSON when called from an agent context, enabling the route-agent to see form submission results and errors

### Modified Capabilities

- None. Existing form behavior is preserved — the HTML-only path is unchanged.

## Impact

- `app/actions/verwaltung/resources/controller.tsx` — add agent branch to `create` action (~8 lines)
- `app/assets/route-agent-stream.tsx` — modify `handleFrameFormSubmit` to sniff content-type and forward JSON results (~10 lines)
- `app/actions/mastra/agents/route-agent.ts` — add instructions for form-driven workflow
