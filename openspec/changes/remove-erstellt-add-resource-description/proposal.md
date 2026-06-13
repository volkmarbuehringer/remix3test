## Why

The admin grids for offerings, appointments, and offering-configs currently show both "Erstellt" (created_at) and "Aktualisiert" (updated_at) timestamp columns. The "Erstellt" column is redundant since the "Aktualisiert" column also updates on creation. Additionally, the resource description (a valuable identifier) is not displayed in these grids, forcing users to navigate to the resources page to see what a resource describes.

## What Changes

- Remove the "Erstellt" column (header + data cell + sort link) from the offerings grid
- Remove the "Erstellt" column from the appointments grid
- Remove the "Erstellt" column and the inline action column (edit/delete buttons) from the offering-configs grid
- Add a "Beschreibung" column showing `resource_description` to the offerings grid
- Add a "Beschreibung" column showing `resource_description` to the appointments grid
- Add a "Beschreibung" column showing `resource_description` to the offering-configs grid
- Add a right-click context menu to offering-configs grid rows (edit + delete), matching the pattern used by offerings and appointments grids

## Capabilities

### New Capabilities

None — no new feature boundaries are introduced.

### Modified Capabilities

None — this is a pure UI/display change. The existing capabilities (offering CRUD, appointment CRUD, offering-config CRUD) have no requirement changes. Resource description data is already JOINed into the row types and is available for display.

## Impact

- **app/ui/admin-offerings-page.tsx** — remove created_at column header/cell, add resource_description column
- **app/ui/admin-appointments-page.tsx** — remove created_at column header/cell, add resource_description column
- **app/ui/admin-offering-configs-page.tsx** — remove created_at column header/cell, remove action column (edit/delete buttons), add resource_description column, add context menu trigger
- **app/assets/admin-offering-configs-context-menu.tsx** — new clientEntry context menu for offering-configs rows
- No data layer changes — `resource_description` is already included in `OfferingRow`, `AppointmentRow`, and `OfferingConfigRow` via LEFT JOIN
- No controller changes — the existing queries already fetch `r.description AS resource_description`
