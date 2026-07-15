## Why

The route agent can create resources via the agent protocol (X-Agent-Thread → JSON response), but when it tries to continue to the next step — configuring offerings for the newly created resource — the offering config controller only speaks HTML redirects. This breaks the two-form chain the agent needs to guide users through.

## What Changes

- Add an `X-Agent-Thread` detection branch to the offering config controller's `create` action, matching the pattern already used by the resource controller
- When agent mode is active, return `{ status: "created", data: { id, resource_id, rules } }` as JSON instead of a 302 redirect
- Log the admin action in agent mode (same as the resource controller does)
- Add an integration test that validates the full two-form chain: create resource via agent protocol → extract resource ID → create offering config via agent protocol with that ID
- Update the route agent instructions to include the two-form chaining pattern for resource creation

## Capabilities

No new or modified capabilities — this is an internal transport protocol change. The existing offering config form validation, CRUD behavior, and UI remain unchanged.

## Impact

- **`app/actions/verwaltung/offering-configs/controller.tsx`**: Add agent mode branch in `create` action
- **`app/actions/verwaltung/offering-configs.test.ts`**: Add test for agent-mode creation + two-form chain
- **`app/actions/mastra/agents/route-agent.ts`**: Add chaining pattern to instructions
