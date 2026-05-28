## 1. Data Layer

- [x] 1.1 Add `clients` table definition to `app/data/schema.ts` (columns: id, name, email, role, status, registered) with `beforeWrite`, `validate`, `afterRead` hooks
- [x] 1.2 Add `clients` DDL statement in `app/data/setup.ts` (CREATE TABLE IF NOT EXISTS) and seed 200 demo client records with alternating roles
- [x] 1.3 Create `app/utils/pagination.ts` with `paginate(db, table, opts)` helper
- [x] 1.4 Create `app/utils/sort-params.ts` with `parseSort(url, opts)` helper

## 2. Route & Controller

- [x] 2.1 Add `client` route to main `routes` tree in `app/routes.ts` with index, grid, edit, save, destroy sub-routes, and `clientGrid` frame
- [x] 2.2 Wire `client` route to controller in `app/router.ts`

## 3. Controller & Actions

- [x] 3.1 Create `app/actions/client-controller.tsx` with `index` action: query DB for first page, render page with Layout + grid Frame
- [x] 3.2 Add `grid` action: query DB with pagination/sort/filter, render `ClientGridPage` fragment
- [x] 3.3 Add `edit` action: query single row, render `ClientEditPage` form
- [x] 3.4 Add `save` action: parse form data, validate, update DB, redirect with preserved query params
- [x] 3.5 Add `destroy` action: validate rowId, delete row, redirect to /client

## 4. UI Components

- [x] 4.1 Create `app/actions/client-grid-page.tsx`: server-rendered grid table with sortable header links, pagination links, filter form, delete forms per row, edit links
- [x] 4.2 Create `app/actions/client-edit-page.tsx`: full-page form with Layout, breadcrumbs, input fields using `input.base`/`input.focus` mixins, role/status selects, save/reset buttons

## 5. Navigation & Validation

- [x] 5.1 Add "Client Lab" nav entry to `app/ui/nav.ts` in Pages section
- [x] 5.2 Verify all files compile with `pnpm run typecheck`

## 6. Tests

- [x] 6.1 Create `app/actions/client-controller.test.ts`: integration tests for GET /client, GET /client/grid, POST /client/save, POST /client/destroy
- [x] 6.2 Create `app/actions/client-grid-page.test.ts`: unit tests for grid rendering, pagination buttons, sort headers
- [x] 6.3 Create `app/actions/client-edit-page.test.ts`: unit tests for edit form rendering, breadcrumbs, field display
