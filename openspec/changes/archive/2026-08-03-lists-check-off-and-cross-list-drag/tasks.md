## 1. Data layer — item done state

- [x] 1.1 Extend the item type in `app/data/lists.ts` so a persisted item may carry `done: boolean` and `parseRow` passes it through reads
- [x] 1.2 Update `assignStableIds` (`app/data/lists.ts:43`) to preserve `done` when present instead of rebuilding items as `{ id, label }`
- [x] 1.3 Add `done: s.optional(s.boolean())` to `listItemSchema` (`app/actions/lists/controller.tsx:30`)
- [x] 1.4 Extend `app/data/lists.test.ts`: `done` survives a create→patch round-trip; an item without `done` still writes and reads as `false`

## 2. Data layer — atomic move

- [x] 2.1 Add `moveItemBetweenLists(db, sourceId, targetId, itemId, userId?, expectedUpdatedAt?)` to `app/data/lists.ts` using `db.transaction` (pattern: `app/data/nutzer.ts:109`); removes the item from the source, appends it to the target, bumps `updated_at` on both
- [x] 2.2 Return distinct outcomes for same-list move, last-item move, and item-not-found-in-source so the controller can map them to `400`
- [x] 2.3 Enforce the source `expectedUpdatedAt` precondition inside the transaction and surface a `conflict` outcome carrying the current source row
- [x] 2.4 Extend `app/data/lists.test.ts`: move updates both rows' items and `updated_at`; last-item and same-list moves fail; stale precondition returns conflict; foreign-owner source/target is not readable

## 3. Route + controller

- [x] 3.1 Add `move: post('/:id/move')` to the `lists` route map (`app/routes.ts:32`)
- [x] 3.2 Add a `move` action to `app/actions/lists/controller.tsx`: parse `{ targetId, itemId }` (and `If-Match` / `_if_match`), resolve `listUserId` like `update` (`controller.tsx:162`), call the data function, map outcomes to `200` (both rows) / `400` / `404` / `409`
- [x] 3.3 Extend `app/actions/lists/controller.test.ts`: successful move returns updated source+target; last-item move returns `400`; foreign target returns `404`; stale precondition returns `409` with the current source row

## 4. Sidebar progress

- [x] 4.1 Add `doneCount` to `ListSidebarEntry` (`app/ui/lists-layout.tsx:29`) and compute it in both `index` paths (ids and paginated) from `row.list`
- [x] 4.2 Render the badge as `done/total` in the sidebar (`lists-layout.tsx:275`)
- [x] 4.3 Extend `app/actions/lists/controller.test.ts`: index response includes `doneCount` matching the seeded items

## 5. Client — check-off interaction

- [x] 5.1 Add a checkbox toggle to each item row in `lists-client.browser.tsx`; toggling flips `done`, marks dirty, and triggers the fast autosave path (300 ms) without breaking the existing editing flow
- [x] 5.2 Render checked items with a struck-through, muted label (and checkbox checked state)
- [x] 5.3 Ensure new items are added without a `done` field (absent = unchecked)

## 6. Client — cross-list drag

- [x] 6.1 Wire `dragover`/`dragenter`/`dragleave`/`drop`/`dragend` on sidebar rows via `document.querySelectorAll('[data-list-id]')`, attached lazily at drag start and re-wired on `reloadComplete` (`lists-client.browser.tsx:323`)
- [x] 6.2 Add `dropTargetSidebar: number | null` state plus a sidebar highlight style; ensure the intra-list reorder indicator and the sidebar highlight are mutually exclusive
- [x] 6.3 On sidebar drop: flush pending autosave first (`flushNow`), then `POST /lists/:sourceId/move` with the refreshed `updated_at` as precondition; on success `navigateFrame(currentHref)`; on `409` show the existing conflict banner; on `400`/`404` revert and show an error
- [x] 6.4 Extract the drop-zone decision (pointer + zone rects → editor zone vs sidebar zone) as a pure helper and unit-test zone resolution and mutual exclusion

## 7. Verification

- [x] 7.1 Run `npm run typecheck`, the lists data/controller tests, and the format check
- [x] 7.2 Manual pass in the running app: check-off persists and reloads; sidebar progress updates after navigation; dragging an item onto another sidebar list moves it and reloads; dragging the last item is rejected; a stale edit triggers the conflict banner rather than a silent move
