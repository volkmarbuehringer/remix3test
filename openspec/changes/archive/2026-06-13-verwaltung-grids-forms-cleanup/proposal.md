## Why

Admin grids in `/verwaltung` display internal `id` columns that have no value for admin users — they consume visual space and add noise. Meanwhile, some forms in the same section lack proper schema validation, risking inconsistent data or cryptic errors on submission.

## What Changes

- Remove the `id` column from all admin grids (offerings, appointments, resources, offering-configs)
- Add `parseSafe` validation to forms missing it: offerings config form, offerings week-generate form, user export form
- Keep sorting/filtering unaffected (IDs are still fetched in queries)

## Capabilities

### New Capabilities

- `verwaltung-grid-refresh`: Remove id column from all 4 interactive grids under `/verwaltung`

### Modified Capabilities

<!-- No spec-level behavior changes — validation is an implementation detail. -->

## Impact

- **UI files**: `app/ui/admin-offerings-page.tsx`, `app/ui/admin-appointments-page.tsx`, `app/ui/admin-resources-page.tsx`, `app/ui/admin-offering-configs-page.tsx` — remove ID column markup from each table header and body
- **Controller**: `app/actions/verwaltung/controller.tsx` — add schema validation to config, week, and delete-past endpoints; shared schemas may be extracted
- **User export**: `app/actions/verwaltung/users-export/controller.tsx` — add schema validation
- **No DB changes** — IDs remain the primary key and are still fetched for row identity
