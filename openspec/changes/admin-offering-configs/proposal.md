## Why

The `offering_configs` table exists in the schema (`app/data/schema.ts`) with dedicated data functions (`getConfig`, `upsertConfig` in `app/data/offering-configs.ts`), but there is no standalone admin interface to manage them directly. Currently, configs are managed indirectly through the offerings config page (`/admin/offerings/config`) which is tightly coupled to the offerings workflow. Adding a dedicated CRUD route gives admins direct control over offering configurations independent of the offerings grid.

## What Changes

- Add a new **Admin Offering Configs** route under `/admin/offering-configs` with full CRUD (list with pagination/sort/filter, create inline form, edit inline form, delete)
- The table displays: resource description, rules summary (day/time ranges), creation date, and last updated date
- The edit/create forms use the established day-by-day time picker from the existing `admin-offerings-config-page.tsx`
- Register the route in the route definitions, controller, router, admin nav, and route labels

## Capabilities

### New Capabilities

- `admin-offering-configs`: Admin CRUD for the `offering_configs` table — list with pagination, sorting (by resource, created_at, updated_at), search filter (by resource description), inline create/edit/delete. Routes: GET `/admin/offering-configs` (index), POST `/admin/offering-configs` (create), PUT `/admin/offering-configs/:id` (update), DELETE `/admin/offering-configs/:id` (destroy).

### Modified Capabilities

_(No existing specs are modified — these are entirely new capabilities.)_

## Impact

- **New files**:
  - `app/actions/admin-offering-configs-controller.tsx` — controller for `/admin/offering-configs`
  - `app/ui/admin-offering-configs-page.tsx` — list + edit/create panels
  - `app/actions/admin-offering-configs-controller.test.ts` — tests
- **Modified files**:
  - `app/routes.ts` — add `offeringConfigs` route definition under `adminRoutes.admin`
  - `app/router.ts` — map new routes to their controller
  - `app/ui/admin-layout.tsx` — add nav item
  - `app/ui/route-labels.ts` — add display label
