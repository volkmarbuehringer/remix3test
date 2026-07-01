## 1. Route + Frame Setup

- [ ] 1.1 Add `listsContent: 'lists-content'` to the `frames` map in `app/routes.ts`
- [ ] 1.2 Confirm no new routes are needed in `routes.lists` (reuse `index`, `show`, `save`, `update`, `data`)

## 2. Lists Sidebar Layout

- [ ] 2.1 Create `app/ui/lists-layout.tsx` as a `createSidebarLayout<ListsNavItem>` config (mirror `app/ui/admin-layout.tsx`): set `frameTarget` to `frames.listsContent`, `headerLabel` 'Listen', a `lists` nav icon, and export `renderListsPage` + `ListsLayout`
- [ ] 2.2 Build the nav group builder that turns list summaries (`id`, `description`, item count, `updated_at`) plus a "New list" item into `NavGroup<ListsNavItem>` entries; each list entry links to `/lists?load=<id>` (or `routes.lists.index.href() + '?load=' + id`) with `target: frames.listsContent`; the "New list" entry links to `/lists`
- [ ] 2.3 Compute the active item from the current request's `?load` query param: matching list id → that item; no/invalid `load` → "New list"

## 3. Lists Index Page + Controller

- [ ] 3.1 Create `app/ui/lists-index-page.tsx` that renders the `ListsClient` editor as the content area (the sidebar is provided by the layout shell); accept the active list id derived from `?load` so the client loads the right list on hydration
- [ ] 3.2 Update `app/actions/lists/controller.tsx` `index` action: query list summaries via `getAllLists(db, pool, { limit: 50, offset: 0 }, user.role === 'admin' ? undefined : user.id)`, derive the active list id from `context.url.searchParams.get('load')`, and render via `renderListsPage(...)` with the summaries as sidebar nav data and `ListsClient` (or `ListsIndexPage`) as content
- [ ] 3.3 Ensure the index response is frame-aware: when `X-Remix-Target` is `lists-content`, the layout factory returns the fragment (content only); otherwise full Layout+Frame (handled by `createSidebarLayout`)

## 4. ListsClient Editor Wiring

- [ ] 4.1 Confirm `ListsClient` still loads `?load=<id>` on hydration via `GET /lists/:id/data` (no regression); verify it re-mounts on lists-frame navigation so a new `?load` triggers a fresh load
- [ ] 4.2 If the client entry does not re-run load on frame navigation, lift the trigger: accept the active list id as a prop from the server-rendered page and react to prop change / `on('frame:navigate')` instead of (or in addition to) reading `location.search` once
- [ ] 4.3 Add a "New list" clear path: when navigating to `/lists` (no `load`), the editor resets `items`, `description`, `nextId`, and `loadedListId = null`; the "Update" button stays disabled until a new save

## 5. Owner-Scoping Verification

- [ ] 5.1 Verify non-admin sidebar only contains the user's own lists (matches `getAllLists` `userId` filter)
- [ ] 5.2 Verify admin sidebar contains all lists
- [ ] 5.3 Verify `GET /lists/<other-user-id>/data` still returns `404` for non-admins (no change to existing `data` action behavior)

## 6. Tests

- [ ] 6.1 Add controller tests in `app/actions/lists/controller.test.ts` for the index action: authenticated non-admin sees only own lists in sidebar data; admin sees all; unauthenticated is rejected
- [ ] 6.2 Add a test that the active list id is derived from `?load` and passed through to the rendered page
- [ ] 6.3 Add a test that frame requests (`X-Remix-Target: lists-content`) render the fragment path

## 7. Verification

- [ ] 7.1 Run `npm run typecheck` — zero type errors
- [ ] 7.2 Run `npm test` — existing lists tests still pass and new tests pass
- [ ] 7.3 Run `npm run start` and manually verify: `/lists` shows the sidebar matching `/admin` chrome; saved lists appear with item-count badges; clicking a list loads it for editing and highlights the entry; "New list" clears the editor; non-admin cannot load another user's list
