## Context

The admin chatlog page at `/admin/chatlog` displays all conversations from the `chatlog` table with an ILIKE text filter, pagination, and expandable message details. Conversations from the `/chat` route have no `toolCalls` data on their messages. Conversations from the `/agent` route have `toolCalls` arrays on assistant messages (from `get_weather`, `search_wikipedia` invocations).

The existing admin sidebar has a "Chat Logs" link that shows all conversations. The request is to add two filtered shortcuts — one showing only chat conversations, one showing only agent conversations — and support a `?type=` query parameter for direct navigation.

## Goals / Non-Goals

**Goals:**
- Support `?type=chat` filter showing only conversations where NO messages have toolCalls
- Support `?type=agent` filter showing only conversations where SOME messages have toolCalls
- Add "Chat Only" and "Agent Only" nav items in the admin sidebar Data section
- Display the active type filter on the chatlog page
- Preserve the `type` parameter in pagination URLs

**Non-Goals:**
- No changes to routes, middleware, database, or package.json
- No back-end query filtering (filtering is done in-memory after fetch — the chatlog table doesn't have a type column)
- No changes to the text search filter behavior (it works alongside the type filter)

## Decisions

### 1. In-memory filtering after DB fetch

**Decision**: Apply the type filter in-memory on the fetched conversations, rather than adding a `type` column or modifying the SQL query. Check `conversation.some(msg => msg.toolCalls && msg.toolCalls.length > 0)` for agent conversations.

**Rationale**: The `chatlog` table doesn't have a `type` column. Adding one would require a migration and schema change. The dataset is already paginated at 5 items per page, so the in-memory filter operates on a small array. For the initial nav link (first page), this is effectively free.

**Trade-off**: The pagination count becomes approximate — if the page is filtered by type, the "total pages" may be slightly off because the unfiltered query fetches 6 rows but the type filter may reduce it. This is acceptable for an admin tool.

### 2. Nav links with query parameters

**Decision**: Add `href?: string` as an optional field on the admin `NavItem` type. When `href` is present, use it directly instead of calling `item.route.href()`. This allows the sidebar links to point to `/admin/chatlog?type=chat` and `/admin/chatlog?type=agent` while the main "Chat Logs" link continues to use the route system.

**Rationale**: The existing route system provides `routes.admin.chatlog.index.href()` which returns `/admin/chatlog`. Appending `?type=chat` is straightforward as a plain href string. The nav renderer already supports `rmx-target` on the link, so frame navigation still works.

### 3. Type filter display

**Decision**: Show the active type filter as a label on the chatlog page (e.g., "Showing: Chat conversations" or "Showing: Agent conversations") when the filter is active, with a link to clear it.

**Rationale**: Provides clear feedback about what filter is active and a quick way to return to "All" view.

## Risks / Trade-offs

- **[Trade-off] Approximate pagination**: When a type filter is active, `hasMore` may be inaccurate (based on the unfiltered fetch). Mitigation: Acceptable for admin tooling; a full solution would require a `type` column and SQL-level filtering.
- **[Risk] Empty results on filter**: If no conversations match the type, the empty state "No conversations yet" is shown. This is the same behavior as the unfiltered empty state.
