## 1. Route + Frame Setup

- [x] 1.1 Add `listsContent: 'lists-content'` to the `frames` map in `app/routes.ts`
- [x] 1.2 Confirm no new routes are needed in `routes.lists` (reuse `index`, `show`, `save`, `update`, `data`)

## 2. Lists Sidebar Layout

- [x] 2.1 Create `app/ui/lists-layout.tsx` as a custom sidebar layout (mirrors `createSidebarLayout` pattern with `xs list` SVG icon, `frames.listsContent` target, `headerLabel` 'Listen', and exports `renderListsPage` + `ListsLayout`)
- [x] 2.2 Build the dynamic nav items: each list summary renders as a `NavLink` targeting `frames.listsContent` with href `/lists?load=<id>`; "New list" entry links to `/lists`; item-count badge shown; empty state hint when no lists
- [x] 2.3 Compute the active item from the current request's `?load` query param: matching list id → that item; no/invalid `load` → "New list"

## 3. Lists Index Page + Controller

- [x] 3.1 Create `app/ui/lists-index-page.tsx` that renders the `ListsClient` editor as the content area (the sidebar is provided by the layout shell); accept the active list id derived from `?load` so the client loads the right list on hydration
- [x] 3.2 Update `app/actions/lists/controller.tsx` `index` action: query list summaries via `getAllLists(db, pool, { limit: 50, offset: 0 }, user.role === 'admin' ? undefined : user.id)`, derive the active list id from `context.url.searchParams.get('load')`, and render via `renderListsPage(...)` with the summaries as sidebar nav data and `ListsClient` (or `ListsIndexPage`) as content
- [x] 3.3 Ensure the index response is frame-aware: when `X-Remix-Target` is `lists-content`, the layout factory returns the fragment (content only); otherwise full Layout+Frame (handled by `createSidebarLayout`)

## 4. ListsClient Editor Wiring

- [x] 4.1 Confirm `ListsClient` still loads `?load=<id>` on hydration via `GET /lists/:id/data` (no regression); verify it re-mounts on lists-frame navigation so a new `?load` triggers a fresh load
- [x] 4.2 If the client entry does not re-run load on frame navigation, lift the trigger: accept the active list id as a prop from the server-rendered page and react to prop change / `on('frame:navigate')` instead of (or in addition to) reading `location.search` once
- [x] 4.3 Add a "New list" clear path: when navigating to `/lists` (no `load`), the editor resets `items`, `description`, `nextId`, and `loadedListId = null`; the "Update" button stays disabled until a new save

## 5. Owner-Scoping Verification

- [x] 5.1 Verify non-admin sidebar only contains the user's own lists (matches `getAllLists` `userId` filter)
- [x] 5.2 Verify admin sidebar contains all lists
- [x] 5.3 Verify `GET /lists/<other-user-id>/data` still returns `404` for non-admins (no change to existing `data` action behavior)

## 6. Tests

- [x] 6.1 Add controller tests in `app/actions/lists/controller.test.ts` for the index action: authenticated non-admin sees only own lists in sidebar data; admin sees all; unauthenticated is rejected
- [x] 6.2 Add a test that the active list id is derived from `?load` and passed through to the rendered page
- [x] 6.3 Add a test that frame requests (`X-Remix-Target: lists-content`) render the fragment path

## 7. Verification

- [x] 7.1 Run `npm run typecheck` — zero type errors
- [x] 7.2 Run `npm test` — existing lists tests still pass and new tests pass
- [ ] 7.3 Run `npm run start` and manually verify: `/lists` shows the sidebar matching `/admin` chrome; saved lists appear with item-count badges; clicking a list loads it for editing and highlights the entry; "New list" clears the editor; non-admin cannot load another user's list
