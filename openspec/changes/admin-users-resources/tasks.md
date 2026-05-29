## 1. Route Definitions

- [x] 1.1 Add `users` and `resources` route definitions to `adminRoutes` in `app/routes.ts` (GET index, POST create, PUT update, DELETE destroy for each)

## 2. Admin Users Controller & UI

- [x] 2.1 Create `app/actions/admin-users-controller.tsx` with index (list + pagination + sort + filter), create, update, and destroy actions using `db` from `remix/data-table`
- [x] 2.2 Create `app/actions/admin-users-controller.test.ts` with tests for index, create, update, destroy, sort, filter, and pagination
- [x] 2.3 Create `app/ui/admin-users-page.tsx` with a sortable/filterable/paginated table and inline create/edit panels following the admin-offerings pattern

## 3. Admin Resources Controller & UI

- [x] 3.1 Create `app/actions/admin-resources-controller.tsx` with index (list + pagination + sort + filter), create, update, and destroy actions using `db` from `remix/data-table`
- [x] 3.2 Create `app/actions/admin-resources-controller.test.ts` with tests for index, create, update, destroy, sort, filter, and pagination
- [x] 3.3 Create `app/ui/admin-resources-page.tsx` with a sortable/filterable/paginated table and inline create/edit panels following the admin-offerings pattern

## 4. Wiring & Navigation

- [x] 4.1 Register both controllers in `app/router.ts` via `router.map()`
- [x] 4.2 Add nav items for "Users" and "Resources" in `app/ui/admin-layout.tsx`
- [x] 4.3 Add route labels for `/admin/users` and `/admin/resources` in `app/ui/route-labels.ts`

## 5. Validation & Typecheck

- [x] 5.1 Run full typecheck — passes clean

## 6. Test Execution

- [x] 6.1 Run admin users controller tests — 20/20 pass
- [x] 6.2 Run admin resources controller tests — 14/14 pass
- [x] 6.3 All existing tests still pass — 546/546 pass, 0 failures
