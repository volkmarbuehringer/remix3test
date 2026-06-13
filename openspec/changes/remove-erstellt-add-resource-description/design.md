## Context

The admin grids for offerings (`admin-offerings-page.tsx`), appointments (`admin-appointments-page.tsx`), and offering-configs (`admin-offering-configs-page.tsx`) each display both "Erstellt" (created_at) and "Aktualisiert" (updated_at) timestamp columns. The "Ressource" column in these grids uses a fallback chain `resource_name ?? resource_description ?? '\u2014'` — hiding the description when a name exists. The data layer already JOINs `r.description AS resource_description` into all three row types (`OfferingRow`, `AppointmentRow`, `OfferingConfigRow`).

## Goals / Non-Goals

**Goals:**
- Remove the "Erstellt" column header + data cell + sort link from each grid
- Remove the inline action column (edit/delete buttons) from the offering-configs grid
- Add a separate "Beschreibung" column displaying `resource_description` as a standalone column
- Split the combined "Ressource" column into "Ressource" (name only) and "Beschreibung" (description only) for clarity
- Add a right-click context menu to offering-configs grid rows (edit + delete) matching the existing pattern from offerings/appointments

**Non-Goals:**
- No data model or schema changes
- No controller/logic changes — data is already present
- No changes to resources admin grid (`admin-resources-page.tsx`)
- No changes to public-facing appointment pages

## Decisions

1. **Separate Beschreibung column instead of keeping combined fallback** — Users need to see both the resource name and its description at a glance. The current fallback `name ?? description` hides one of them. With "Erstellt" removed, we have exactly one free column slot to add "Beschreibung".

2. **Column order: place Beschreibung after Ressource** — Keeps resource-related columns adjacent. The old Erstellt position is reused for Beschreibung.

3. **No sort link on Beschreibung** — The existing sort on `r.description` stays on the "Ressource" header (name column) since that's the natural sort for resource identity.

4. **Context menu for offering-configs** — Follows the proven pattern from `admin-offerings-context-menu.tsx` and `admin-appointments-context-menu.tsx`: a `clientEntry` component with `menu.contextTrigger()` delegation on `[data-offering-configs-table]`. The action column (edit glyph + delete form button) is removed and replaced by the context menu. Hidden delete forms are kept in the DOM (like offerings/appointments) for `form.requestSubmit()` to work from the context menu.

## Risks / Trade-offs

- The grid column layout is adjusted identically across three files. The change is mechanical, but each file must be updated consistently.
- No existing tests cover the column rendering — visual verification needed after deployment.
- The offering-configs grid previously had inline delete with `data-confirm`; the context menu uses `confirm()` in the JS handler (consistent with the existing pattern).
