## Context

The `resources` table currently has columns: `id`, `description`, `created_at`, `updated_at`. Resource identification in dropdowns (offerings, appointments, offering-configs) and the admin grid relies entirely on `description`. There is no separate short "name" for quick identification — `description` serves both as a label and as a free-text field, often becoming verbose or inconsistent.

Existing queries that display resource labels use `r.description` directly. Seed data creates resources with `description` only.

## Goals / Non-Goals

**Goals:**

- Add a required `name` column (TEXT NOT NULL) to the `resources` table
- Require `name` to be at least 4 characters (server-side validation via `remix/data-schema`)
- Display `name` as the primary column in the admin resources table
- Update all resource dropdowns (offerings, appointments, offering-configs) to show `name` instead of `description` as the option label
- Update seed data to include `name` values
- Provide a default of `'Unbenannt'` for existing rows via ALTER TABLE

**Non-Goals:**

- Removing or renaming `description` — it stays as an optional free-text field
- Changing the resource filtering logic — only the displayed label changes
- Adding unique constraints on `name` — duplicates are allowed

## Decisions

### Decision: Add column via ALTER TABLE, not DROP/CREATE

- **Choice**: `ALTER TABLE resources ADD COLUMN name TEXT NOT NULL DEFAULT 'Unbenannt'`
- **Rationale**: Unlike the original `add-resource-table` change (which could DROP/CREATE because it was a clean break), this change runs on an existing database with rows. ALTER TABLE preserves existing data and requires no migration of foreign-key relationships.
- **Alternatives considered**: DROP/CREATE — would require re-creating FKs and re-inserting data; overkill for a single column.

### Decision: Update resource dropdowns to use `name`

- **Choice**: Change all `SELECT id, description FROM resources ORDER BY description ASC` queries to `SELECT id, name, description FROM resources ORDER BY name ASC`, and display `row.name` in `<option>` labels.
- **Rationale**: `name` is the concise identifier; `description` remains available as tooltip/fallback.
- **Alternatives considered**: Concatenate `name — description` — clutters the dropdown for resources with long descriptions.

### Decision: `name` replaces `description` as the sortable/filterable column in the admin grid

- **Choice**: The admin resources table's sort and search pivot from `description` to `name`.
- **Rationale**: Users identify resources by their short name, not the longer description.

## Risks / Trade-offs

- **[Existing data]** Existing rows get `'Unbenannt'` as the default name. → Mitigation: Admin can edit names via the existing edit panel immediately.
- **[Outdated spec]** The original `resource-management` spec at `openspec/changes/add-resource-table/specs/resource-management/spec.md` will be out of date until archived. → Mitigation: Delta spec captures the change; archive of `add-resource-table` will reconcile.
- **[Offering configs]** The `offering_configs` table has a `resource_id` FK and the config page shows resource descriptions. → Mitigation: The offering-configs page uses the same listing query — updating that query is included in scope.
