## 1. Routes

- [x] 1.1 Add `update`, `create`, and `destroy` to the nutzer route definition in `app/routes.ts`
- [x] 1.2 Verify router.ts already maps the controller generically (it uses `router.map(adminRoutes.admin.nutzer, adminNutzerController)` — should work for new sub-routes automatically)

## 2. Type & Data Layer

- [x] 2.1 Add `l_id` to the `NutzerRow` interface in `app/ui/admin-nutzer-page.tsx` (needed by update handler to target the login row)

## 3. Controller — Action Handlers

- [x] 3.1 Add `update` action to `app/actions/admin-nutzer-controller.tsx`: parse form data (including hidden `_l_id`), execute `UPDATE nutzer SET ... WHERE n_id=$1` (from route param), execute `UPDATE login SET ... WHERE l_id=$1` (from hidden field `_l_id`), redirect back to `/admin/nutzer`
- [x] 3.2 Add `create` action: parse form data, `INSERT INTO login ... RETURNING l_id`, `INSERT INTO nutzer ...` with that l_id, redirect back to `/admin/nutzer?editing=N` to show the new row
- [x] 3.3 Add `destroy` action: `DELETE FROM nutzer WHERE n_id=$1 RETURNING n_lid`, then `DELETE FROM login WHERE l_id=$1` (using the returned `n_lid`), redirect back to `/admin/nutzer`

## 4. Controller — Index Edit/Create Support

- [x] 4.1 Modify the `index` action to check for `?editing=N` query param, load that row's data (both tables), and pass `editRow` to the page component
- [x] 4.2 Modify the `index` action to check for `?creating=true` query param and pass `creating` flag to the page component

## 5. UI — Edit Form Panel

- [x] 5.1 Create `app/ui/admin-nutzer-edit-page.tsx` with an edit form panel (following `edit-page.tsx` pattern): fields for vorname, name, email, verpflichtung, login, aktiv, gesperrt; includes hidden `_l_id` field populated from the edit-load query; uses `RestfulForm` with `PUT` method; includes `GridStateHiddenInputs`; Save + Cancel buttons

## 6. UI — Create Form Panel

- [x] 6.1 Create `app/ui/admin-nutzer-create-page.tsx` with a create form panel (following `create-page.tsx` pattern): same fields as edit but empty defaults; uses `RestfulForm` with `POST` method; includes `GridStateHiddenInputs`; Create + Cancel buttons

## 7. UI — Grid Page Updates

- [x] 7.1 Add "Edit" and "Del" buttons to each row in `app/ui/admin-nutzer-page.tsx`
- [x] 7.2 Add "Add New" button above the table
- [x] 7.3 When `editRow` prop is provided, render the table + edit panel in a two-column layout
- [x] 7.4 When `creating` prop is true, render the table + create panel in a two-column layout
- [x] 7.5 Add `NutzerDelButton` client-entry component (or similar) for delete confirmation flow

## 8. Tests

- [x] 8.1 Add integration tests for update: successful update updates both tables, invalid ID returns error
- [x] 8.2 Add integration tests for create: successful creation creates both rows, new row appears in grid
- [x] 8.3 Add integration tests for destroy: successful deletion removes both rows, deleted row no longer in grid
- [x] 8.4 Add integration tests for edit panel: ?editing=N loads correct row data in the form
- [x] 8.5 Add integration tests for create panel: ?creating=true shows the create form
