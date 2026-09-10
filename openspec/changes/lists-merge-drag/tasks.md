## 1. Data layer

- [x] 1.1 Add `MergeResult` type and `mergeListIntoList(db, sourceId, targetId, userId, { expectedUpdatedAt })` to `app/data/lists.ts`: lock both rows in id order inside one transaction, return `{ ok: false, reason: 'same_list' | 'empty_source' | 'not_found' | 'conflict' | ... }` or `{ ok: true, target }`. Verify with a focused data test or by the controller tests in group 4.
- [x] 1.2 Implement the copy step: map every source item to `{ ...item, id: crypto.randomUUID() }`, concatenate after the target's items, preserve `done`/`priority`/`due`/`tags`/`updatedAt`, bump only the target's `updated_at`. Verify source row is unchanged and copied ids differ from the originals.

## 2. Route and controller

- [x] 2.1 Add `merge: post('/:id/merge')` to the `lists` route map in `app/routes.ts`; verify `routes.lists.merge.href({ id: 1 })` resolves to `/lists/1/merge` (typecheck).
- [x] 2.2 Add a `listsMergeSchema` (`{ targetId: s.number() }`) and a `merge` action to `app/actions/lists/controller.tsx` that requires `If-Match`/`_if_match`, calls `mergeListIntoList`, and maps results: `200` target row, `400` self-drop / empty source / missing precondition / bad body, `404` unknown or foreign list, `409` with the current source row. Verify by running `npm run typecheck`.

## 3. Sidebar markup and client drag wiring

- [x] 3.1 Make sidebar list rows draggable in `app/ui/lists-layout.tsx` (`draggable` on the `[data-list-id]` wrapper) and confirm the target `data-updated-at` is rendered. Verify a rendered `/lists` page exposes both attributes.
- [x] 3.2 In `app/actions/lists/public/lists-client.tsx`, add list-drag state (`dragKind: 'item' | 'list' | null`, dragged source id) and a `dragstart` listener on `[data-list-id]` rows that sets `dataTransfer` type `text/x-list-id` to the source id, sets `effectAllowed = 'copy'`, guards inner `button`/`input`/`textarea`/`[contenteditable]`, and never assigns `dragIndex`. Verify item drag/reorder still works.
- [x] 3.3 Add list-drag `dragover` highlight (valid target rows only, excluding the source) and `dragend` cleanup; keep the highlight mutually exclusive with the intra-list indicator. Verify by manual drag or a client e2e test.
- [x] 3.4 Implement the drop handler: `window.confirm` with source/target names and item count, flush the loaded list if source or target is loaded, `POST /lists/:sourceId/merge { targetId }` with `If-Match` and CSRF headers, reload the frame on `200`, and surface `409`/errors through the existing conflict/error state. Verify a successful merge appends items and a declined confirm sends no request.

## 4. Tests

- [x] 4.1 Add `POST /lists/:id/merge` tests to `app/actions/lists/controller.test.ts`: copies all items with fresh ids, appends after existing target items, leaves the source unchanged, bumps the target `updated_at`, and returns `200` with the target row.
- [x] 4.2 Add rejection tests: self-drop `400`, empty source `400`, missing `If-Match` `400`, foreign/unknown list `404`, stale `If-Match` `409` with the current source row. Verify with `npm test`.
- [x] 4.3 Add a client test (or extend an existing lists client e2e test) asserting the list-drag drop calls the merge endpoint and reloads on success, and that a declined confirmation issues no request.

## 5. Verification

- [x] 5.1 Run `npm run typecheck`, `npm test`, and `npm run lint`; fix any regressions.
- [x] 5.2 Run `node_modules/.bin/openspec validate lists-merge-drag` and confirm it passes.
