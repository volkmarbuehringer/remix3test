## 1. Data layer (`app/lib/lists-api.ts`)

- [x] 1.1 Replace `createList(db, input, userId)` so that every item in `input.items` receives a server-issued stable string id (`crypto.randomUUID()`) before persistence; preserve any client-supplied id only when non-empty and unique within the array.
- [x] 1.2 Delete `updateList` and `renameList`. Add `patchList(db, id, partial, userId?, options?: { expectedUpdatedAt?: number })` returning `{ ok: true, row: ListRow } | { ok: false, reason: 'not_found' } | { ok: false, reason: 'conflict', current: ListRow }`. The partial accepts `{ description?, items? }`; at least one key is required by the caller. Bump `updated_at` only on success.
- [x] 1.3 In `patchList`, when `partial.items` is provided and any client item lacks an id, assign a fresh UUID to that item before persisting; preserve all other ids verbatim.
- [x] 1.4 Keep `getListById` and `getAllLists` unchanged in shape; only confirm `getAllLists` forwards `filter` through to the existing `pool.query` path (already does). No code change expected unless the user-side action wasn't passing `filter` before — verified in 4.2.
- [x] 1.5 Update `app/lib/lists-api.test.ts`: delete `updateList`/`renameList` tests; add cases for `createList` issuing stable ids, `patchList` description-only, items-only, both, not-found, conflict (mismatched `expectedUpdatedAt`), force-overwrite (re-PATCH with current `updated_at`).
- [x] 1.6 Run `npm test -- lists-api` and ensure green.

## 2. Route map (`app/routes.ts`) and router wiring

- [x] 2.1 In the `lists` route group, remove `save`, `update`, `rename`, `show`, `data`. Add `create: post('/')` and `patch: put('/:id')` (use PUT since browsers only support GET/POST via forms; the client sends PATCH-style intent over POST/PUT — match what the existing fetch calls can emit; if PUT is wired via `remix/router` fetch-proxy-style, keep PUT, otherwise fall back to `POST /:id/patch`). Confirm by reading `remix/router` route helpers which methods are exported and pick the closest one that the client `fetch` can call.
- [x] 2.2 Confirm `app/router.ts` still maps `routes.lists` to the same controller export; the export name stays `default` (a single controller for the group), no router change needed.

## 3. Session controller (`app/actions/lists/controller.tsx`)

- [x] 3.1 Define `listsPatchSchema = s.object({ description: s.string().pipe(...).optional(), items: s.array(listItemSchema).optional() })` plus a runtime guard that at least one of `description`/`items` is present.
- [x] 3.2 Rewrite `index`: keep pagination + sidebar build; when `?load=:id` resolves to a real, owned list, serialize the row as initial state for `ListsClient` (see 5.1). Keep returning the shell via `renderListsPage`; pass an `initialState` prop down to `ListsIndexPage` → `ListsClient`.
- [x] 3.3 Add `create` action: reuse `listsSaveSchema` (description + items required), call `createList`, respond `200 { id, description, items, updated_at }`.
- [x] 3.4 Add `patch` action: parse `:id`; read `If-Match` header (fall back to body `_if_match`); call `patchList` with `expectedUpdatedAt`; on `reason: 'not_found'` respond `404`, on `reason: 'conflict'` respond `409` with the current row body + `ETag: <updated_at>` header, on success respond `200` with the new row + `ETag`.
- [x] 3.5 Delete `save`, `update`, `rename`, `data`, `show` actions. Delete the `import { ListsShowPage } from './show-page.tsx'` line and remove `app/actions/lists/show-page.tsx` from the repo.
- [x] 3.6 Updated `destroy` action preserves `?load=` drop and just redirects to `/lists?offset=...` as today; no behavior change beyond route name.
- [x] 3.7 Verify the admin `lists` controller (`app/actions/admin/lists/controller.tsx`) still compiles: it imports only `lists` table and `db.delete`; it does not call `updateList`/`renameList`/`createList`, so no change is required — confirm with a `grep` and skip.

## 4. Sidebar search (`app/ui/lists-layout.tsx` and user `index`)

- [x] 4.1 In `app/ui/lists-layout.tsx`, add a search `<input>` directly under the `Meine Listen` label. On input (debounced 250 ms via a local timer in the `ListsLayout` server component is not possible — instead render an inline `<input>` plus a small `clientEntry` script that updates `handle.frame.src` to `/lists?filter=<value>` and calls `handle.frame.reload()`). Create or extend the existing `ListsClient` initial-state island to host this small search controller, OR introduce a tiny dedicated `clientEntry` `lists-search.tsx` under `app/assets/`.
- [x] 4.2 In the `index` action, parse `context.url.searchParams.get('filter')` and forward it to `getAllLists(... { offset, limit, filter }, listUserId)`. The existing `getAllLists` already handles `filter`.
- [x] 4.3 When `?filter=` is present, drop `?load=` (search replaces editing-context). When `?load=` is present after a write, the redirect/`?load=` rebuild in `lists-layout.tsx`'s `buildListHref`/`buildPageHref` continues to omit `filter` so the saved list is visible in the sidebar.
- [x] 4.4 Add a test for the user `index` action: with `filter=foo`, only matching lists are returned and the `user_id` scope still holds (admin sees all, user sees own only).

## 5. Client editor rewrite (`app/assets/lists-client.tsx`)

- [x] 5.1 Server-injected initial state: `ListsClient` reads a server-rendered JSON island (`<script type="application/json" id="lists-initial-state">` emitted inside `ListsIndexPage`) on first render. Parse once; populate `items`, `description`, `loadedListId`, `loadedUpdatedAt` from it. If absent, start in "new list" state.
- [x] 5.2 Remove the `loadListFromServer` / `reloadListFromFrame` second-fetch logic; the frame `reloadComplete` listener now only resets `expectedListId` from the new frame URL and re-reads the JSON island (which the new frame response will have rewritten).
- [x] 5.3 Replace the `saveToStorage` (POST `/lists/save`) and `updateList` (PUT `/lists/:id/update`) fetches with a single `saveNow()` that:
  - when `loadedListId === null`: POST `/lists` with `{ description, items }` and no `If-Match`; on success set `loadedListId`, set `loadedUpdatedAt` from response body, navigate the frame to `/lists?load=<newId>`.
  - when `loadedListId !== null`: PATCH `/lists/:id` with the dirty partial (`{ description }` only, `{ items }` only, or both) and `If-Match: <loadedUpdatedAt>`; on 200 update `loadedUpdatedAt` from body and clear dirty flags; on 409 set conflict state from body.
- [x] 5.4 Stop rewriting item ids in `deleteItem` and stop resetting `nextId` to `items.length + 1`. Delete `deleteItem`'s `.map((item, i) => ({ ...item, id: (i+1).toString() }))` line; just filter. On `addItem`, generate the new item's id client-side as `crypto.randomUUID()` so optimistic UI has a stable key immediately; the server will accept and confirm on save.
- [x] 5.5 Implement the autosave state machine: `idle → dirty → saving → saved|error → idle`. Debounce 1500 ms default, 300 ms on add-item and on description-input blur. Only schedule when there are actual changes (compare shallow).
- [x] 5.6 Add the status pill to the control bar (`Gespeichert` / `Speichern…` / `Ungespeichert` / `Fehler`) using the existing `button`/`css` theme tokens. Demote the manual `Aktualisieren`/`Hinzufügen` buttons visually (smaller, secondary tone) but keep them functional as immediate-flush triggers.
- [x] 5.7 Add a conflict banner above the items list, shown on 409 only, with two buttons: `Neu laden` (discard local state, reload frame at current `?load=`) and `Trotzdem speichern` (re-issue `saveNow()` with `If-Match` = `updated_at` from the 409 body). While the banner is shown, autosave is suspended.
- [x] 5.8 On navigate-away (`handle.signal` aborted) with pending dirty state, attempt a best-effort flush via `navigator.sendBeacon` to `/lists/:id` with `_if_match` in the body. Accept that beacon cannot carry custom headers; document this in a code comment.
- [-] 5.9 Add a regression test (Playwright or `clientEntry`-level test in `app/assets/lists-client.test.ts` if a harness exists) covering: create flow, autosave flow, 409 flow, stable ids across delete.

## 6. Sidebar rename reroute (`app/assets/list-name-edit.tsx`)

- [x] 6.1 Change the fetch URL from `/lists/${listId}/rename` to PATCH `/lists/${listId}` with body `{ description: trimmed }` and `If-Match` header read from the entry's `data-updated-at` attribute (added to sidebar entries by `lists-layout.tsx` in 4.x / 5.1 — emit `data-updated-at={row.updated_at}` on each `entryRowStyle` div).
- [x] 6.2 On 200, update the entry's `data-updated-at` to the response body's `updated_at` and the visible label as today; on 409, briefly flash the entry red and abort the inline edit without applying.
- [-] 6.3 Run the existing `list-name-edit` interaction manually (no automated test exists today).

## 7. Dead-route cull verification

- [x] 7.1 `grep -rn 'routes.lists.show' app/ test/` — confirm zero references before deleting.
- [x] 7.2 Delete `app/actions/lists/show-page.tsx`.
- [x] 7.3 `grep -rn 'routes.lists.save\|routes.lists.update\|routes.lists.rename\|routes.lists.data' app/ test/` — confirm zero references after the controller rewrite lands.
- [x] 7.4 `grep -rn 'updateList\|renameList' app/ test/` — confirm zero references after `lists-api.ts` rewrite + tests.

## 8. Cross-cutting checks

- [x] 8.1 `npm run typecheck` clean.
- [x] 8.2 `npm run lint` clean (apply `format-code` on touched files).
- [x] 8.3 `npm test` green end-to-end (all suites, not just lists).
- [-] 8.4 Manual smoke: create → edit → drag-reorder → delete-item → sidebar-rename → concurrent-tab edit (expect 409 + reload) → sidebar search → clear search. Confirm item ids remain stable across all of the above (inspect the persisted row in the DB or add a temporary debug log).
- [-] 8.5 Update `openspec/specs/lists-editing/spec.md` and `openspec/specs/lists-search/spec.md` (sync from delta) is done by the archive step at the close of the change — do not pre-sync here.
