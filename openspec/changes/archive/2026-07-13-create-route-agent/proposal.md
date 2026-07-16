## Why

The current route-agent controller uses the `testAgent` Mastra agent, which exposes all workspace tools (read, write, edit, delete, grep, mkdir, file_stat) plus routeNavigate, findList, and askUserTool. This is an unnecessary security and clarity concern — the route agent only needs to navigate the user to pages and find lists. Exposing file-system tools to a navigation-focused agent creates risk of unintended file mutation and confuses the agent's decision-making.

A dedicated route agent with a minimal toolset (routeNavigate, findList, askUserTool) will be cleaner, safer, and more focused.

## What Changes

- **New file**: `app/actions/mastra/agents/route-agent.ts` — a Mastra Agent with only `routeNavigate`, `findList`, and `askUserTool`. No workspace, no workspace tools, no `listTestFiles`.
- **Modified file**: `app/actions/mastra/index.ts` — register `routeAgent` in the Mastra agents object.
- **Modified file**: `app/actions/route-agent/controller.tsx` — switch from `mastra.getAgent('testAgent')` to `mastra.getAgent('routeAgent')`, remove the `requireApproval` check (no longer needed).
- **Modified file**: `app/actions/route-agent/controller.tsx` — clean up imports: remove Workspace-related types, remove `requireApproval` function, keep route-navigate/findList/askUserTool UX.

## Capabilities

### New Capabilities

- `dedicated-route-agent`: A minimal Mastra agent with only routeNavigate, findList, and askUserTool — no workspace tools, no file-system access.

### Modified Capabilities

<!-- No existing specs need modification — this is purely an implementation change -->

## Impact

- `app/actions/mastra/agents/route-agent.ts` — new file
- `app/actions/mastra/index.ts` — add import and registration
- `app/actions/route-agent/controller.tsx` — use routeAgent instead of testAgent, remove requireApproval
- No UI changes — the agent is transparent to the user
- No route changes — same endpoints
