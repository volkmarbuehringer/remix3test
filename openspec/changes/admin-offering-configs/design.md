## Context

The app has an `offering_configs` table defined in `app/data/schema.ts` with `data-table` support. The table has columns: `id`, `resource_id` (UNIQUE FK to `resources`), `rules` (JSONB), `created_at`, `updated_at`. The existing `app/data/offering-configs.ts` provides `getConfig()`, `upsertConfig()`, `generateWeek()`, and `previewWeek()` functions used by the offerings admin page.

Existing admin routes (resources, users, nutzer, offerings, appointments) follow a consistent pattern: controller in `app/actions/`, UI page in `app/ui/`, route definition in `app/routes.ts`, registration in `app/router.ts`, nav entry in `app/ui/admin-layout.tsx`, and label in `app/ui/route-labels.ts`.

## Goals / Non-Goals

**Goals:**

- Provide full admin CRUD (list, create, update, delete) for the `offering_configs` table at `/admin/offering-configs`
- Follow existing admin patterns: paginated table with sort, filter/search, inline edit/create panels via grid state (offset, sort, order, filter)
- Respect security: routes protected by `requireAuth()` and `requireAdmin()` middleware
- Reuse the day-by-day time picker pattern from the existing offerings config page for `rules` editing

**Non-Goals:**

- Changes to the offerings grid or the week-generation flow
- Bulk operations on offering configs
- Any changes to existing `offerings`, `offerings/config`, or `offerings/week` routes
- Schema changes (table structure stays as-is)

## Decisions

1. **Use `resources()` route helper** — Same as `users` and `resources`. The `offering_configs` table has `data-table` schema definitions, so CRUD via `db` is simpler and type-safe.

2. **Inline edit/create panels** — Follow the resources/offerings pattern: main page renders a paginated table; "Edit" sets `?editing=<id>`, "Add New" sets `?creating=true`. Both render a side panel in a two-column layout.

3. **Rules editing with day/time picker** — The `rules` field is JSONB structured as `{ monday: [540, 1020], wednesday: [540, 1200] }`. Reuse the day-by-day select pattern from `admin-offerings-config-page.tsx` rather than showing a raw JSON textarea. Each day has a select for start time and end time.

4. **Search with ILIKE on resource description** — Use a JOIN on `resources` table and ILIKE on `resources.description`, matching the existing admin filter pattern.

5. **Resource selection via dropdown** — On create/edit, show a `<select>` listing all resources. The UNIQUE constraint on `resource_id` means one config per resource — the controller must validate and handle the duplicate gracefully (return a 400 with a clear message).

6. **DELETE with no FK concerns** — `offering_configs.resource_id` has `ON DELETE CASCADE`, so deleting a config has no cascading impact beyond the config itself.

7. **Use `db` directly instead of raw SQL** — Unlike the `appointoffering` table (which uses raw SQL for int4range), `offering_configs` columns are standard types handled by `data-table`. Use `db.create()`, `db.updateMany()`, `db.deleteMany()`, `db.query()` for CRUD.
