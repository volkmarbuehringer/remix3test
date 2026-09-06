## Why

The uploads grid only supports deleting one file at a time via a per-row trash button. Admins (and users) who need to clear several files today must click each row's delete action repeatedly. Adding a multirow delete lets a user select multiple files on the current page and remove them in one submission, keeping the existing per-row delete for single-file removal.

## What Changes

- Add a multirow delete to `/admin/uploads`: the grid gains a checkbox column (one per row plus a header "select all" toggle) and an "Ausgewählte löschen" bulk action button.
- Add a new bulk delete endpoint `POST /admin/uploads/delete-many` that deletes all selected rows in one database operation, preserving the existing ownership scoping (admins delete any row; a non-admin deletes only rows they claimed).
- Add `GET /admin/uploads/delete-many` as the frame action-path resolver (the frame runtime commits a submitted POST action path as its `src` and reloads it on invalidate; that path must resolve as GET and render the grid).
- Keep the existing per-row delete (`POST /admin/uploads/:id/delete`) unchanged and coexisting.
- Add a confirmation dialog for the bulk delete ("N Dateien wirklich löschen?") that counts the currently selected checkboxes.
- After a bulk delete, the result redirects back to the same grid view (page/sort/order/filter) and, when rows were removed, shows a "N Dateien gelöscht." banner.
- Add a `deleteUploads(db, ids, userId?)` data function that deletes multiple rows via `id = ANY($1::int[])` and returns the number of rows deleted.

## Capabilities

### New Capabilities

<!-- None: the multirow delete extends the existing /admin/uploads behavior. -->

### Modified Capabilities

- `admin-uploads-route`: The uploads page contract gains a bulk-delete requirement — a checkbox-based multirow delete at `POST /admin/uploads/delete-many` (with a GET resolver) that honors per-user ownership and preserves the grid view on return.

## Impact

- `app/routes.ts` — add `destroyMany: post('/delete-many')` and `destroyManyResolve: get('/delete-many')` to the `admin.uploads` route map.
- `app/actions/admin/uploads/controller.tsx` — implement `destroyMany`/`destroyManyResolve` actions; render the checkbox column, header select-all, bulk action button, and the deleted-count banner.
- `app/data/uploads.ts` — add `deleteUploads(db, ids, userId?)`.
- `app/actions/admin/public/admin-uploads-bulk-delete.tsx` — new clientEntry for select-all, count label, and the count-based confirm.
- `app/actions/admin/uploads/controller.test.ts` and `app/data/uploads.test.ts` — add multirow delete coverage.
