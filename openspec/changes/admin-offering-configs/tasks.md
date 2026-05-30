## 1. Route Definition

- [x] 1.1 Add `offeringConfigs` route definition to `adminRoutes` in `app/routes.ts` using `resources('offering-configs', { exclude: ['new', 'show', 'edit'] })`

## 2. Controller

- [x] 2.1 Create `app/actions/admin-offering-configs-controller.tsx` with index (list + pagination + sort + filter via JOIN on resources), create, update, and destroy actions using `db` from `remix/data-table`

## 3. UI Page

- [x] 3.1 Create `app/ui/admin-offering-configs-page.tsx` with a sortable/filterable/paginated table, inline create/edit panels, and day-by-day time picker for the `rules` field

## 4. Wiring & Navigation

- [x] 4.1 Register the controller in `app/router.ts` via `router.map()`
- [x] 4.2 Add nav item "Offering Configs" in `app/ui/admin-layout.tsx` in the "Data" group
- [x] 4.3 Add label `'/admin/offering-configs': 'Offering Configs'` in `app/ui/route-labels.ts`

## 5. Tests

- [x] 5.1 Create `app/actions/admin-offering-configs-controller.test.ts` with tests for index, create, update, destroy, sort, filter, pagination, and auth gating

## 6. Verification

- [x] 6.1 Run `npm run typecheck` — no type errors
- [x] 6.2 Run `npm test` — 15 new tests pass (560 total, 0 fail from this change)
- [ ] 6.3 Start server and verify `/admin/offering-configs` is accessible and functional
