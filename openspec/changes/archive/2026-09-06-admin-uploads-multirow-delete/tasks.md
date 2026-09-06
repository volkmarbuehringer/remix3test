## 1. Data layer

- [x] 1.1 Add `deleteUploads(db, ids, userId?)` to `app/data/uploads.ts` that deduplicates the ids and deletes via `id = ANY($1::int[])`, adding `AND uploaded_by = $2` for a non-admin, and returns `affectedRows ?? 0`. Verify by asserting a new `app/data/uploads.test.ts` case deletes the claimed rows (and leaves another user's row for a non-admin).
- [x] 1.2 Confirm `deleteUploads` with an empty/after-dedupe empty id array is a harmless no-op returning 0 (test asserts no rows deleted and a 0 return).

## 2. Routes

- [x] 2.1 Add `destroyMany: post('/delete-many')` and `destroyManyResolve: get('/delete-many')` to `admin.uploads` in `app/routes.ts`. Verify `npm run typecheck` passes and `routes.admin.uploads.destroyMany`/`destroyManyResolve` resolve (covered by the controller test asserting the paths).

## 3. Controller

- [x] 3.1 Implement `destroyMany` in `app/actions/admin/uploads/controller.tsx`: read `context.formData.getAll('ids')`, map to numbers, filter out `NaN`, call `deleteUploads` with `user.role === 'admin' ? undefined : user.id`, then redirect to `uploadsPageHref(...)` preserving `_page`/`_sort`/`_order`/`_filter` and appending `deleted=<count>`.
- [x] 3.2 Implement `destroyManyResolve` in the controller to render the grid (`renderUploadsPage(context)`), mirroring the existing `destroyResolve`.
- [x] 3.3 Extend `renderUploadsPage`/`UploadsContent` to read a `deleted` URL param and render a "N Dateien gelöscht." banner when `N > 0` (symmetric with the existing `uploadError` handling).
- [x] 3.4 Add the checkbox column to the uploads table: a header toggle (not named `ids`) plus a per-row `<input type="checkbox" name="ids" value={u.id}>`, and wire the bulk form to `routes.admin.uploads.destroyMany.href()` carrying `UploadsGridStateHiddenInputs`.
- [x] 3.5 Add the bulk action button ("Ausgewählte löschen") to the grid toolbar, initially disabled (enabled via the clientEntry), and render the new `<UploadBulkDelete />` clientEntry.

## 4. Client-side selection

- [x] 4.1 Create `app/actions/admin/public/admin-uploads-bulk-delete.tsx` as a `clientEntry` that toggles the page's row checkboxes from the header select-all, updates the bulk button label/disabled state on selection change, and on submit confirms `"${n} Dateien wirklich löschen?"` (blocking submission when cancelled). Verify the existing uploads browser/DOM tests and `npm run typecheck` pass.

## 5. Tests

- [x] 5.1 Add controller tests for the bulk delete: admin deletes several selected rows; a non-admin deletes only its own and leaves another user's row; grid state (`_page`/`_sort`/`_order`/`_filter`) is preserved on the redirect; a `deleted=N` param renders the banner; a no-op submission (no valid ids) still redirects and deletes nothing.
- [x] 5.2 Add a controller test asserting `GET /admin/uploads/delete-many` (destroyManyResolve) renders the uploads page with the checkbox column present.
- [x] 5.3 Run `npm run typecheck` and the uploads suite, and verify all existing uploads tests (single-row delete, destroyResolve, ownership) still pass.
