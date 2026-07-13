## Context

The route agent (`app/actions/mastra/agents/route-agent.ts`) has a `findList` tool that searches lists by ILIKE on description. Currently it accepts only `search` and returns up to 10 results. The agent then either picks a list to navigate to, or uses `askUserTool` to ask the user which one.

The lists page (`/lists`) already has a full sidebar UI with search/filter, pagination, and click-to-select. The user wants to reuse this sidebar as the selection surface for the agent's list search results.

## Goals / Non-Goals

**Goals:**
- Extend `findList` tool with `sort`, `limit`, `offset` params for richer queries
- Add `?ids=` query param to the lists controller's `index` action for showing specific lists in the sidebar
- Update route agent instructions to use the pattern: `findList` → `routeNavigate("/lists?ids=...")` for multi-result, direct `routeNavigate("/lists?load=...")` for single-result
- Keep the existing `?filter=` search working independently — `ids` is agent-driven, `filter` is user-driven

**Non-Goals:**
- No new UI components or route changes
- No changes to list editing, autosave, or resource-oriented write actions
- No changes to the lists client component (`ListsClient`)
- No changes to the sidebar search debounce or frame reload behavior

## Decisions

1. **`findList` schema grows, doesn't break**: Add optional `sort` (`"newest"` | `"oldest"`), `limit` (number, default 10, max 50), `offset` (number, default 0). Backward-compatible — old calls with just `search` continue working.

2. **Separate `getListsByIds` helper in data layer**: Rather than overloading `getAllLists` with an `ids` option, a new `getListsByIds(db, ids, userId)` returns rows in the given ID order. Simpler, testable in isolation, and avoids branching the existing pagination/filter logic.

3. **`ids` param format**: Comma-separated integers, e.g., `?ids=1,5,12`. Invalid or non-numeric entries are silently ignored. If `ids` is present, the controller ignores `filter`, `offset`, and `limit` — the sidebar shows exactly those lists (plus the "Neue Liste" nav item).

4. **Sidebar links do NOT preserve `ids`**: When the user clicks a list in the sidebar, the link goes to `/lists?load=42` (standard `buildListHref`). The sidebar snaps back to the user's full paginated list. This is intentional — the `ids` filter is ephemeral.

5. **Agent behavior for single-result**: When `findList` returns exactly 1 row, the agent navigates directly to `/lists?load=<id>`. The sidebar highlights the active list normally.

6. **Agent behavior for zero results**: The agent uses `askUserTool` to inform the user and suggest alternatives, same as now.

## Risks / Trade-offs

- **IDs get stale**: If a list is deleted between `findList` and the navigation, the lists controller's `getListsByIds` will simply not include it (it acts as a filter, returns fewer rows). No crash, the user just sees fewer options.
- **URL length**: `?ids=1,2,3,...,50` for 50 IDs is roughly 200 chars. Well within URL limits. The `limit` cap at 50 prevents unbounded growth.
- **Agent behavior change**: Existing route agent conversations used the old pattern (findList → pick one). After this change, existing threads with memory will still work (the tools haven't been removed), but new conversations will follow the new pattern.
