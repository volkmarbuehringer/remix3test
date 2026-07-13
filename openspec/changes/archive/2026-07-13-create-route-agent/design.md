## Context

The existing route agent at `app/actions/route-agent/controller.tsx` uses `mastra.getAgent('testAgent')` to handle navigation requests. `testAgent` (defined in `app/actions/mastra/agents/test-agent.ts`) carries a full `Workspace` with filesystem tools (read, write, edit, delete, mkdir, grep, file_stat) and `listTestFiles`. The route agent only needs to navigate pages and find lists — it should not have file-system capabilities.

## Goals / Non-Goals

**Goals:**
- Create a new `routeAgent` Mastra agent with only `routeNavigate`, `findList`, and `askUserTool`
- Update the route-agent controller to use the new agent
- Remove the `requireApproval` logic from the controller (no workspace tools to approve)

**Non-Goals:**
- No UI changes — the route agent page and stream client remain identical
- No route changes — same endpoints at `/route-agent/*`
- No behavioral changes from the user's perspective

## Decisions

1. **New agent file, not inline definition**: Creating `app/actions/mastra/agents/route-agent.ts` follows the existing pattern used by `test-agent.ts`, `customer-agent.ts`, and `support-agent.ts`. Avoids bloating the controller and keeps agents discoverable in one directory.

2. **No Workspace, no workspace tools**: The agent is instantiated without a `workspace` property. It only gets `tools: { routeNavigate, findList, askUserTool }`. This means the agent cannot read, write, edit, delete files — it can only navigate and search lists.

3. **No requireApproval**: Since there are no workspace tools (which require approval), the `requireApproval` callback is removed from the controller. The `askUserTool` suspends the agent for user questions (handled via `/answer` endpoint), so that approval path remains intact.

4. **Agent instructions optimized for navigation**: The instructions focus on navigating to pages and finding lists. No file-system guidance, no workspace tool descriptions.

## Risks / Trade-offs

- **Regression risk**: The controller currently uses `testAgent` with all its tools. If the new agent is registered with the wrong ID or the controller references a non-existent agent, the route agent endpoint will return 500 errors. Mitigated by the same `mastra.getAgent()` pattern and type safety.
- **Agent behavior drift**: The new agent has a different instructions string, which could alter its behavior slightly. Mitigated by keeping instructions tightly scoped and testing with the same prompts the old agent handled.
- **No `requireApproval` for unknown extensions**: If a future developer adds a tool that needs approval to the route agent, they must also add `requireApproval` back. This is acceptable — the minimal toolset doesn't need it.
