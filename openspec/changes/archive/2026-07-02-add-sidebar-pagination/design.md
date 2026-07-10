## Context

The lists sidebar at `/lists` loads all user lists via `getAllLists()` with a hardcoded `limit: 50, offset: 0`. The backend function already supports offset-based pagination and returns `{ data, hasMore, offset }`, but the controller ignores `hasMore` and passes everything straight to the `ListsLayout` component as `sidebarEntries`. Users with >50 lists cannot see or access any lists beyond the first 50.

The sidebar uses the `Frame` navigation pattern with `target={frames.listsContent}`. Pagination controls must work within this same frame-based mechanism — navigating to the next page should re-render the sidebar list within the existing frame, preserving the active list highlight.

## Goals / Non-Goals

**Goals:**

- Add "Vorherige" (Previous) and "Nächste" (Next) controls below the sidebar list entries
- Allow users to browse through all their lists, 15 at a time
- Preserve the active list highlight across page boundaries
- Maintain the existing frame-based navigation pattern

**Non-Goals:**

- Changing the page size (stays at 15)
- Adding search/filter to the sidebar (separate concern)
- Changing the data fetching layer (`getAllLists` already supports this)
- Infinite scroll or virtual scrolling

## Decisions

1. **Query param `?offset=` for page tracking** — The lists index action already uses `?load=` for active list. Adding `?offset=` communicates page state through the URL, which is the idiomatic Remix pattern. The controller reads `offset` from query params and passes it through to `getAllLists`.

2. **Pagination controls rendered server-side in `ListsLayout`** — Since sidebar entries are rendered server-side from the controller, the pagination buttons are rendered the same way. The controller passes `offset`, `hasMore`, and the current page number to `renderListsPage` / `ListsLayout`.

3. **NavLink with `?offset=` links** — Previous and Next buttons are `<NavLink>` elements targeting the same frame, linking to `?offset=<prev_page>` or `?offset=<next_page>`. This re-fetches the lists index action with the new offset, causing a full sidebar re-render within the frame.

4. **Offset preserved across list navigation** — When clicking a list entry, the `buildListHref` appends both `?load=<id>` and `?offset=<current_offset>` so clicking back to the sidebar doesn't reset the page.

5. **Active page indicator** — A simple "Seite X" label between the Previous/Next buttons shows the current page (offset / limit + 1).

## Risks / Trade-offs

- [Full page reload on pagination] → Mitigation: Frame target ensures only the lists content area re-renders, not the entire page. This is the same pattern used for list navigation.
- [Active list highlight lost if list is on a different page] → Acceptable trade-off. When navigating, the active list is on the current page; switching pages naturally shows a different set. The `activeItem` is derived from `?load=` and checked against the current `sidebarEntries`.
