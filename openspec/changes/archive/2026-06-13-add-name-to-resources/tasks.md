## 1. Database & Schema

- [x] 1.1 Add `name TEXT NOT NULL DEFAULT 'Unbenannt'` to `resources` CREATE TABLE in `app/data/migrate.ts`
- [x] 1.2 Add ALTER TABLE migration for existing databases in `app/data/migrate.ts`
- [x] 1.3 Add `name` column definition to `resources` table in `app/data/schema.ts`
- [x] 1.4 Update `beforeWrite` in schema to trim `name` on create/update

## 2. Resource Controller (verwaltung — resources CRUD)

- [x] 2.1 Add `'name'` to `RESOURCE_FORM_KEYS` array
- [x] 2.2 Update `resourceSaveSchema` to include `name` with `minLength(4)` validation
- [x] 2.3 Add `'name'` to `RESOURCES_SORTABLE_FIELDS` as first entry
- [x] 2.4 Update `loadResourcePageData` filter to search `name` instead of `description`
- [x] 2.5 Update `loadResourcePageData` default sort column to `'name'`
- [x] 2.6 Update `create` handler to pass `name` in `db.create()` call and audit log
- [x] 2.7 Update `update` handler to pass `name` in `db.updateMany()` call and audit log

## 3. Resource UI (admin-resources-page)

- [x] 3.1 Add `name` column to table header and row cells (before description column)
- [x] 3.2 Update column widths in `<colgroup>` to accommodate `name`
- [x] 3.3 Add `name` input field to `AdminResourcesEditPanel` with min-length error
- [x] 3.4 Add `name` input field to `AdminResourcesCreatePanel` with min-length error

## 4. Resource Dropdowns — Replace `description` with `name` as display label

- [x] 4.1 Update offerings resource query in `verwaltung/controller.tsx` to `SELECT id, name, description` and pass `resource_name` to page
- [x] 4.2 Update appointments resource query in `verwaltung/controller.tsx` to `SELECT id, name, description` and pass `resource_name`
- [x] 4.3 Update offering-configs resource query in `verwaltung/controller.tsx` to `SELECT id, name, description` and pass `resource_name`
- [x] 4.4 Update appointments-new resource query in `appointments-new/controller.tsx` to `SELECT id, name, description`
- [x] 4.5 Update PDF controller's resource query to include `name` (`verwaltung/pdf/controller.tsx`)

## 5. Dropdown UI — Show `name` instead of `description`

- [x] 5.1 Update `admin-offerings-page.tsx` to display `resource_name` in table and sort columns
- [x] 5.2 Update `admin-appointments-page.tsx` to display `resource_name` in table and sort columns
- [x] 5.3 Update `admin-offerings-config-page.tsx` resource select to show `name`
- [x] 5.4 Update `admin-offering-configs-page.tsx` to display `resource_name` in table and dropdown
- [x] 5.5 Update `appointments-new-page.tsx` to display `resource_name` in table and sort columns
- [x] 5.6 Update `appointment-sidebar.tsx` to display resource `name` in dropdown
- [x] 5.7 Update `appointment-page.tsx` data interface to expect `name` on resources

## 6. Seed Data

- [x] 6.1 Update `app/data/seed.ts` to include `name` in seeded resource rows (e.g., `name: "Raum 1"`, `name: "Raum 2"`)

## 7. Delete Confirmation

- [x] 7.1 Create shared `app/assets/confirm-delete.tsx` clientEntry component
- [x] 7.2 Add `data-confirm` + ConfirmDelete to resources delete forms
- [x] 7.3 Add `data-confirm` + ConfirmDelete to offering-configs delete forms

## 8. Verification

- [x] 8.1 Run `pnpm run typecheck` and fix any type errors
- [x] 8.2 Run `pnpm test` and fix any failing tests
