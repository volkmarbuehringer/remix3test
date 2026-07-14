## Why

The route agent currently navigates users to forms but cannot pass values into them. The user types what they already told the agent ("create a resource called Meeting Room A"), then fills the name again in the form — redundant and friction-prone. A prefilled form moves the agent from "navigator" to "assistant": the agent extracts values from the conversation, fills them into the form, and the user only reviews and confirms.

This also validates whether existing server-rendered Remix forms can be reused in an agent-driven flow without per-form client-side code — the core architectural question explored in the current session.

## What Changes

- Extend the agent's SSE `navigate` event to carry optional `prefill` data (key-value map of field values)
- Update `entry.tsx`'s `resolveFrameResponse` to inject prefill data as a request header on Frame GET fetches
- Add a controller-level mechanism (`readAgentPrefill`) that checks the header and returns prefill values for form rendering
- Modify the resource create form to read prefill values as `defaultValue` overrides when present
- Update the route agent's instructions to extract resource names from user messages and include them in navigate calls
- Add a test scenario: "create a resource called {name}" where the name is pre-filled

## Capabilities

### New Capabilities

- `agent-form-prefill`: Mechanism for the route agent to pass structured field values to a server-rendered form, which renders them as pre-filled defaults. The user reviews and submits — no re-typing.

### Modified Capabilities

- `resources-form-validation`: The resource create form renders with pre-filled values from the agent when the request carries a prefill context. Validation errors still re-render with inline errors and preserve user edits (existing behavior unchanged).

## Impact

- `app/assets/entry.tsx` — `resolveFrameResponse` checks agent prefill store, injects `X-Agent-Prefill` header on Frame GET
- `app/assets/route-agent-stream.tsx` — handle `prefill` field in `navigate` SSE event, store until Frame resolves
- `app/actions/mastra/agents/route-agent.ts` — agent instructions: extract name from "create resource called {name}" and include prefill in navigate call
- `app/actions/verwaltung/resources/controller.tsx` — read prefill header, pass values to form as default `formValues`
- `app/ui/admin-resources-page.tsx` — create form renders `defaultValue` from `formValues.name` when present
