## 1. Routes — admin.lists map gains full CRUD

- [x] 1.1 In `app/routes.ts`, add `create` (`post('/')`) and `update` (`put('/:id')`) to the `admin.lists` route map, keeping `index` (`get('/')`) and changing `destroy` from `post('/:id/delete')` to `del('/:id')`. Verify: `npm run typecheck` passes and `routes.admin.lists` exposes `create`/`update`/`destroy`.

## 2. Controller — index gains grid state and editing/creating modes

- [x] 2.1 In `app/actions/admin/lists/controller.tsx`, replace the manual `offset`/`filter` read in `index` with `parseSort` over `SORTABLE_FIELDS = ['id','title','description','created_at','updated_at']` (default `created_at`/`desc`) plus grid-state `offset`/`sort`/`order`/`filter` reads. Verify: `npm run typecheck` passes and the index re-renders ordered by the requested column.
- [x] 2.2 Add `editing=<id>` (load `editRow` via `findOne`) and `creating=true` handling to `index`, passing `editRow`/`creating`/`sortColumn`/`sortDirection`/the `filter` into `AdminListsPage`. Verify: `npm run typecheck` passes and `GET /admin/lists?editing=5` renders the inline edit panel populated from row 5.

## 3. Controller — create action (validation, 200 re-render, PRG)

- [x] 3.1 Add a `listsFormSchema` (`s.object` with `title` required min length 1 and optional `description`) and a `renderListsError` adapter binding `AdminListsPage` to `renderGridFormError`, mirroring `renderUsersError`. Verify: `npm run typecheck` passes and the adapter signature matches `renderGridFormError`.
- [x] 3.2 Implement `create`: parse the form via `s.parseSafe(listsFormSchema, formData)`, and on failure re-render at status 200 with `formValues` + `fieldErrors` via `renderListsError` (NOT 400). Verify: a new test asserts the create validation failure returns 200 with inline errors and preserved values.
- [x] 3.3 On successful `create`, insert the row with `list` defaulting to `[]` and no owning user (```db.create(lists, { title, description, list: [] })```), audit-log via `logAdminAction`, then redirect with grid state preserved and `editing=<newId>`. Verify: the create success test asserts a 3xx redirect carrying `offset/sort/order/filter` and `editing=<newId>`.

## 4. Controller — update action (validation, 200 re-render, PRG)

- [x] 4.1 Implement `update` (PUT `/:id`): parse via `s.parseSafe`, on failure re-render at 200 with inline errors via `renderListsError`, and on success update only `title` and `description` (never `list` or `user_id`), then redirect with grid state preserved. Verify: `npm run typecheck` passes; the update test asserts only title/description are written and the `list` items array is unchanged.
- [x] 4.2 Update the `destroy` action to preserve grid state and surface non-field errors (invalid/missing id) via `context.session.flash('error', msg)` + `redirect(listsGridUrl(formData))`, replacing the bare `Invalid list ID` 400. Verify: the destroy test asserts a 302 with the flash error readable from the session, and grid state preserved.

## 5. Page — sortable headers, inline forms, action cell, empty-state CTA

- [x] 5.1 In `app/ui/admin-lists-page.tsx`, add sortable column headers using `sortArrow`/`buildSortUrl` over the grid-state params, add `GridStateHiddenInputs` to the create/edit forms and the row DELETE forms, and add `data-rmx-target={frames.adminContent}` to every creation/edit/delete/row action. Verify: `npm run typecheck` passes and the rendered row exposes a frame-targeted edit link plus a DELETE form with `data-delete-form`/`data-confirm`.
- [x] 5.2 Add an inline create `RestfulForm method="POST"` (action `admin.lists.create`) and inline edit `RestfulForm method="PUT"` (action `admin.lists.update` for the `editRow` id) panel, both carrying `data-rmx-target` and `GridStateHiddenInputs`. Verify: `npm run typecheck` passes and the panels render only when `creating`/`editRow` is set.
- [x] 5.3 Add the empty-state `Neu anlegen` CTA (frame-targeted `buildCreateUrl`) when `rows.length === 0` and no form panel is active (`!hasFormPanel`, where `hasFormPanel = Boolean(editRow || creating)`). Verify: `npm run typecheck` passes and the CTA renders only on an empty grid with no active form panel.

## 6. Tests — confirm the new contract

- [x] 6.1 Add `app/actions/admin/lists/controller.test.ts` asserting: the index renders sorted/filtered/paginated rows from grid-state params; create and update validation failures return 200 inline-error fragments with preserved `formValues`/the `fieldErrors`; successful create/update/delete redirect (3xx) with grid state preserved (`editing=` on create); the destroy uses the DELETE verb; non-field errors (invalid/missing id) redirect with `session.flash`. Verify: `npm test` green.

## 7. Verification

- [x] 7.1 Run the full verification: `npm test`, `npm run typecheck`, `npm run format:fix`. Verify: all pass with no failures beyond the updated expectations.
