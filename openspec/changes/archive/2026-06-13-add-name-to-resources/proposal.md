## Why

Resources currently only have a `description` field. There is no concise "name" or "label" for a resource, making it hard to identify resources at a glance in dropdowns, tables, and UI references. Adding a required `name` field with a minimum length of 4 characters provides a clean, identifiable label for each resource.

## What Changes

- **`resources` table**: add `name` column (TEXT, NOT NULL), defaulting existing rows to `'Unbenannt'`
- **Resource CRUD**: add `name` as a required field in create and edit forms, validated at min 4 characters server-side
- **Resource table UI**: display `name` as the primary column, retain `description` as secondary
- **Resource dropdowns** in offerings, appointments, and config forms: show `name` instead of `description` as the option label
- **Seed data**: update to include `name` values for seeded resources

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `resource-management`: Resource entity gains a required `name` field (min 4 chars) that serves as the primary display label. Existing `description` remains optional/unvalidated for extended notes.

## Impact

- **Schema** (`app/data/schema.ts`): Add `name` column to `resources` table definition
- **Migration** (`app/data/migrate.ts`): ALTER TABLE to add `name` column; update seed data
- **Controller** (`app/actions/verwaltung/controller.tsx`): Update `RESOURCE_FORM_KEYS`, `resourceSaveSchema` to include `name` with min-length validation; update CRUD handlers to pass `name`
- **UI** (`app/ui/admin-resources-page.tsx`): Add `name` input to create/edit panels; add `name` column to table display
- **DB queries** that SELECT from `resources` where `description` is displayed as label: offerings, appointments, offering-configs resource dropdowns
- **Type** (`Resource` type): auto-includes `name` via schema
