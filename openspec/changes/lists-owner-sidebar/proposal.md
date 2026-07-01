## Why

The `/lists` page lets a user build and save lists, but once a list is saved there is no way to see or reopen previously saved lists from within the page. Users must remember a list's id or leave `/lists` to find it. The `/admin` area already solves this discovery problem with a persistent sidebar (`createSidebarLayout`) listing every section; `/lists` should reuse that pattern so a user can see all lists they created and load any of them for editing with one click.

## What Changes

- Render `/lists` with the shared `createSidebarLayout` shell (the same mechanism `/admin` uses), giving the page a left sidebar + content grid.
- The sidebar lists every list the current user owns, ordered by most-recently-updated, with the description as the label and an item-count badge. The active list (the one currently loaded for editing) is highlighted.
- Clicking a sidebar entry loads that list into the existing `ListsClient` editor for editing (reusing the current `?load=<id>` / `GET /lists/:id/data` flow).
- Add a `GET /lists` (index) variant that returns the current user's list summaries (id, description, item count, updated_at) so the sidebar can be server-rendered. Non-admin users only see their own lists; admins see all lists (consistent with the existing `getListById`/`updateList` owner-scoping in `app/lib/lists-api.ts`).
- Add a "New list" sidebar entry that clears the editor so the user can start a fresh list.
- Preserve all existing editor operations (add/edit/delete/reorder/reverse/shuffle, save, update).

## Capabilities

### New Capabilities
- `lists-owner-sidebar`: A sidebar on `/lists` that lists every list owned by the current user (server-rendered, owner-scoped), highlights the list currently loaded for editing, and lets the user load any list into the editor with a single click, plus a "New list" entry to start fresh.

### Modified Capabilities
<!-- No existing spec covers the /lists route behavior, so there are no requirement deltas to existing capabilities. -->

## Impact

- **New files**: a lists sidebar layout module under `app/ui/` (e.g. `app/ui/lists-layout.tsx`) built from `createSidebarLayout`; a lists index page component (server-rendered list summaries) under `app/ui/`; tests for the lists controller index action (owner scoping + sidebar data).
- **Modified files**: `app/actions/lists/controller.tsx` (index action renders the sidebar layout + passes the user's list summaries; reuses `getAllLists` with the current user's id), `app/assets/lists-client.tsx` (accept the preselected/active list id from props/server instead of only reading `?load` on the client, and expose a way to clear the editor for a "new list").
- **Reused code**: `app/ui/sidebar-layout.tsx` (`createSidebarLayout`), `app/lib/lists-api.ts` (`getAllLists` with `userId`, `getListById`), existing `routes.lists` route map (no new routes needed).
- **Dependencies**: None — uses existing `remix/ui`, theme tokens, and `remix/router` controller APIs already in the app.
- **Systems touched**: `/lists` route rendering (adopts sidebar layout), lists controller index action (now queries list summaries).
