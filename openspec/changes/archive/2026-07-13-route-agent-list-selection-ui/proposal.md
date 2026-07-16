## Why

When the route agent searches for lists via `findList`, it currently decides for the user which list to navigate to (picking the "best" match) or falls back to a clunky `askUserTool` text prompt. The lists sidebar already provides a polished selection UI — the agent should set the stage by filtering the sidebar to its search results, then let the user pick naturally.

## What Changes

- **`findList` tool** gains `sort`, `limit`, and `offset` params so the agent can express queries like "10 newest lists" or "lists updated last week"
- **Lists controller** gains an `ids` query param — when present, the sidebar shows only those specific list IDs (scoped by user ownership)
- **Route agent instructions** updated to use the new pattern: call `findList`, then navigate to `/lists?ids=<comma-separated>` so the user picks from the sidebar. On single-result, navigate directly to `/lists?load=<id>`.
- **Lists sidebar search** remains independent — the `ids` param is for agent-driven filtering, `filter` is for user-driven search. The `ids` param drops naturally when the user clicks a sidebar entry (standard navigation to `/lists?load=<id>`).

## Capabilities

### New Capabilities

- `enriched-findlist`: The `findList` tool supports `search`, `sort`, `limit`, and `offset` parameters for richer list discovery queries
- `lists-sidebar-agent-results`: The `/lists` route accepts an `?ids=` query parameter to show only specified lists in the sidebar

### Modified Capabilities

- `dedicated-route-agent`: Route agent instructions change to prefer the `findList → routeNavigate("/lists?ids=...")` pattern, using `askUserTool` only when no lists are found or the search is ambiguous
- `lists-search`: The lists controller's `index` action accepts an `ids` param alongside the existing `filter` param

## Impact

- `app/actions/mastra/tools/route-find-list.ts` — extend input schema with sort, limit, offset
- `app/actions/lists/controller.tsx` — add `ids` query param handling to the `index` action
- `app/data/lists.ts` — `getAllLists` may need an `ids` filter option, or a new `getListsByIds` helper
- `app/actions/mastra/agents/route-agent.ts` — update agent instructions
- No new routes, no UI components, no breaking API changes
