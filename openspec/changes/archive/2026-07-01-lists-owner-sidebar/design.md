## Context

`/lists` is a per-user interactive list editor backed by `app/actions/lists/controller.tsx` and the `ListsClient` client entry (`app/assets/lists-client.tsx`). Lists are persisted server-side in the `lists` table (columns: `id`, `user_id`, `list` jsonb, `description`, `created_at`, `updated_at`); all read/write helpers in `app/lib/lists-api.ts` already scope by `user_id` (non-admins only see their own rows, admins see all). Today the index action renders `<Layout><ListsClient /></Layout>` — a single content column with no overview of previously saved lists. To reopen a saved list the client reads `?load=<id>` from `location.search` on hydration and fetches `GET /lists/:id/data`.

`/admin` solves overview+edit navigation with `createSidebarLayout` (`app/ui/sidebar-layout.tsx`): a 220px sticky sidebar of nav links + a content area, with frame-aware rendering (`X-Remix-Target` → fragment, otherwise full Layout+Frame). The admin layout (`app/ui/admin-layout.tsx`) is a thin config wrapper over that factory. This change reuses the same factory for `/lists` so the two areas share the exact sidebar chrome.

## Goals / Non-Goals

**Goals:**

- Render `/lists` with `createSidebarLayout` so it visually matches `/admin` (sidebar + content grid).
- Server-render the sidebar from the current user's list summaries (owner-scoped), ordered by `updated_at desc`.
- Highlight the list currently loaded for editing; clicking a sidebar entry loads it into `ListsClient` for editing via the existing `GET /lists/:id/data` flow.
- Provide a "New list" entry that clears the editor to start fresh.
- Keep all existing editor operations and the save/update endpoints unchanged.

**Non-Goals:**

- No new routes — reuse `routes.lists` (`index`, `show`, `save`, `update`, `data`).
- No pagination on the sidebar (the per-user list count is small; a hard limit with "more" affordance is a later iteration).
- No search/filter on the sidebar (the admin lists page already has search at `/admin/lists`).
- No renaming, reordering, or deleting lists from the sidebar itself (delete stays on the admin page).
- No changes to the `lists` table schema or the API (`api/lists`) token-auth surface.

## Decisions

### 1. Reuse `createSidebarLayout` instead of a bespoke layout

**Decision**: Build `app/ui/lists-layout.tsx` as a `createSidebarLayout<ListsNavItem>` config (mirroring `admin-layout.tsx`), with a `lists` frame target and a nav group whose items are the user's list summaries plus a "New list" entry.

**Rationale**: The factory already encapsulates sticky sidebar styling, `NavLink` active-state, breadcrumbs, and frame-vs-full-page rendering. Duplicating that CSS risks drift between `/admin` and `/lists`. The factory is generic over the nav item id type, so per-user dynamic items fit cleanly.

**Alternative considered**: Render a hand-rolled two-column grid inside `ListsClient`. Rejected — it would not match admin chrome, would duplicate ~90 lines of sidebar CSS, and would force client-side fetching of the list summaries (losing server-rendered HTML).

### 2. Sidebar entries are server-rendered from the index action

**Decision**: The `index` action queries list summaries via the existing `getAllLists(db, pool, { limit, offset }, userId)` and passes them as props to a new `ListsIndexPage` component, which renders inside the sidebar layout's content area. The sidebar nav items are derived from those same summaries.

**Rationale**: Keeps the sidebar server-rendered (fast first paint, no flash), reuses the owner-scoped helper that already exists, and stays consistent with how `/admin/lists` server-renders rows. The `ListsClient` editor becomes the content shown when a list is loaded (or for a new list).

**Alternative considered**: Fetch summaries client-side in `ListsClient` and render the sidebar there. Rejected — loses SSR, duplicates owner-scoping logic on the client, and breaks the "looks like /admin" goal.

### 3. Active list is conveyed via `?load=<id>` (existing convention), with sidebar links targeting the lists frame

**Decision**: Sidebar entries link to `/lists?load=<id>` (or `/lists` for "New list") with `rmx-target={listsFrame}` so navigation swaps only the content frame, not the sidebar. The active entry is computed by comparing the current `?load` value to each item's id. `ListsClient` keeps reading `?load` on hydration, so no change to its load mechanism is needed.

**Rationale**: Reuses the load flow that already works and is tested. Frame-targeted links give partial-page navigation identical to `/admin`'s `adminContent` frame, so the sidebar never reloads and stays in place.

**Alternative considered**: Add a new `GET /lists/:id`-driven "edit" route that the sidebar links to. Rejected — adds a route, splits rendering, and the `show` route currently renders a static placeholder (`show-page.tsx`); repurposing it would break the existing `show` contract.

### 4. Admins see all lists, non-admins see only their own

**Decision**: Pass `userId = user.role === 'admin' ? undefined : user.id` to `getAllLists`, exactly as `getListById`/`updateList` already do for the editor.

**Rationale**: Consistent with the existing owner-scoping in `app/lib/lists-api.ts` and the `update`/`data` actions in `app/actions/lists/controller.tsx`. Admins already edit any list; the sidebar should reflect that same visibility.

### 5. Frame target name: `lists-content`

**Decision**: Add `listsContent: 'lists-content'` to the `frames` map in `app/routes.ts` and use it as the lists layout's `frameTarget`.

**Rationale**: Matches the existing `frames.adminContent` pattern; the sidebar layout's `isFrameRequest()` check reads `X-Remix-Target` against this name to decide fragment vs full render.

## Risks / Trade-offs

- **[Risk] Sidebar and content share one index action** — the action now both queries summaries and renders the editor shell. → Mitigation: the query is a single owner-scoped `findMany`; keep the limit small (e.g. 50) so it stays cheap. The editor itself remains a client entry.
- **[Risk] `ListsClient` currently reads `?load` only on first hydration** — switching lists via sidebar frame navigation must re-run the load. → Mitigation: because the sidebar link targets the lists frame, the frame swaps and `ListsClient` re-mounts, re-running hydration and picking up the new `?load`. Verify this in tests; if the frame does not remount the client entry, lift load-trigger to `on('frame:navigate')`/`handle` prop change.
- **[Trade-off] No sidebar pagination** — users with many lists get a long sidebar. Acceptable for now; cap with `limit` and revisit if needed.
- **[Trade-off] "New list" clears in-memory editor state but does not delete the server row** — intended (start fresh without losing saved lists), but must be clearly signaled in the UI.
