## Context

The `/verwaltung` admin section has 4 interactive data grids (offerings, appointments, resources, offering-configs) that all display an internal `id` column as the first column. This column is useful for developers debugging but provides no value to admin users. Additionally, several endpoints accept form data without schema-level validation: the offerings config save, week generation, and user export endpoints.

## Goals / Non-Goals

**Goals:**

- Remove the `id` `th`/`td` pair from each of the 4 grid tables
- Add `parseSafe` validation to the 3 endpoints missing it
- Keep all existing sorting, filtering, and pagination working

**Non-Goals:**

- No DB schema changes (IDs remain PKs and are still fetched in queries)
- No CSS/layout restructuring (grids keep existing column spacing)
- No changes to PDF grids or report1 (already have no id column)

## Decisions

- **Remove column markup only** — do not alter SQL queries; IDs stay in the fetched row data because they are used for row identity in context menus, edit panels, and delete actions
- **Use existing schema pattern** — follow the established `s.parseSafe(schema, formData)` + `issuesToFieldErrors()` pattern used by other verwaltung endpoints; no new validation library needed
- **Shared schema extraction** — extract inline schemas from the controller into `app/utils/` only if reused; otherwise keep them colocated in the controller
- **User export** — uses a standalone controller; add a simple schema there for startDate/endDate validation

## Risks / Trade-offs

- **Grid column imbalance** — removing the id column shifts the remaining columns left. This is acceptable; the first real column ("KW", "Titel", "Name", "Ressource") provides sufficient context
- **CSV export not affected** — only HTML grids are changed; no data export is impacted
- **Week generate validation** — currently only checks `year`/`week` are valid ints; adding proper schema validation is a strict improvement but introduces a new error path. Mitigation: return field-level errors via the existing form error banner
