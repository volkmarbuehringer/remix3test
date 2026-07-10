## Why

The `/admin/nutzer` page displays user data from two joined tables (`nutzer` + `login`) but is currently read-only. Administrators need to edit, create, and delete user records through the admin interface. This is a straightforward data management task — the data model is simple (two tables, one-to-one via `n_lid`) and the existing Client Lab demonstrates the exact inline editing pattern to follow.

## What Changes

- **Update route** (`PUT /admin/nutzer/:id`): Update both `nutzer` and `login` rows in two sequential SQL statements within a single handler.
- **Create route** (`POST /admin/nutzer`): Insert a new `login` row first, then a `nutzer` row referencing it.
- **Delete route** (`DELETE /admin/nutzer/:id`): Delete `nutzer` row first (FK), then `login` row.
- **Inline edit panel** (like Client Lab): A sidebar panel slides in when `?editing=N` is set, showing a form with all editable fields from both tables.
- **Inline create panel** (like Client Lab): A sidebar panel slides in when `?creating=true` is set.
- **Row actions**: Each row in the table gets Edit and Del buttons.
- **Field exclusions**: `l_letzte_login` is system-set and not editable. All other fields (`n_vorname`, `n_name`, `n_email`, `n_verpflichtung`, `l_login`, `l_aktiv`, `l_gesperrt`) are editable.

## Capabilities

### New Capabilities

- `admin-nutzer-crud`: Administrative user management with inline create, read, update, and delete across the `nutzer` and `login` tables, accessible via the Admin sidebar under "Nutzer".

### Modified Capabilities

- _(none — no existing specs are changing)_

## Impact

- `app/routes.ts` — add `update`, `create`, `destroy` to the `nutzer` route definition
- `app/router.ts` — map the new routes (already uses `adminNutzerController`)
- `app/actions/admin-nutzer-controller.tsx` — add `update`, `create`, `destroy` action handlers; modify `index` to support `?editing=N` and `?creating=true` state
- `app/ui/admin-nutzer-page.tsx` — add action buttons (Edit/Del) to table rows; add inline edit and create panels (new components, or inline in the page)
- New UI components: edit form panel, create form panel (following `edit-page.tsx` / `create-page.tsx` patterns from Client Lab)
- `app/actions/admin-nutzer-controller.test.tsx` — add tests for update, create, destroy
- No new dependencies — uses existing `pg` pool and existing UI primitives (`RestfulForm`, `Button`, etc.)
