<!-- Context: project-intelligence/newapp/guides/admin-offerings-ui | Priority: high | Version: 1.0 | Updated: 2026-05-26 -->

# Guide: Admin Offerings UI

**Purpose**: UI components for the admin offerings CRUD grid — grid page, edit/create sidebar forms, and grid state preservation.

---

## Grid Page (`app/ui/admin-offerings-page.tsx`)

Single-page component that conditionally renders in one or two columns:

- **Toolbar**: "+ Add New" / "+ Add Week" / config buttons with `rmx-target={frames.adminContent}`
- **Filter bar**: GET form with text input, submit query, conditional "Zurücksetzen" link
- **Table**: Sortable columns (ID, KW, WD, Tag, Resource, Zeitraum, Erstellt, Aktualisiert)
- **Action cells**: Edit link + `RestfulForm method="DELETE"` button
- **Pagination**: Offset-based, "Zurück"/"Weiter" links, "Zeige N–M"
- **Two-column layout**: `gridTemplateColumns: '1fr 380px'` with sticky sidebar

### Format Helpers

| Helper | Input | Output |
|--------|-------|--------|
| `formatWeekday(day)` | BIGINT ms | `Mo`–`So` |
| `formatWeekNumber(day)` | BIGINT ms | ISO week number |
| `formatDate(day)` | BIGINT ms | `DD.MM.YYYY` (de-DE) |
| `formatDuring(during)` | `"[start,end)"` | `HH:MM–HH:MM` |
| `formatTimestamp(ts)` | BIGINT ms | `DD.MM.YYYY, HH:MM` (de-DE) |

## Edit Form (`app/ui/admin-offerings-edit-page.tsx`)

`RestfulForm method="PUT" action="/admin/offerings/:id"` with:

- Resource dropdown, date input, start/end time dropdowns (hourly 00:00–24:00)
- Pre-selects current values
- ID badge in panel header
- "Speichern" / "Abbrechen" + `GridStateHiddenInputs`

## Create Form (`app/ui/admin-offerings-create-page.tsx`)

`RestfulForm method="POST" action="/admin/offerings"` with:

- Same fields as edit, defaults to 08:00–17:00
- Placeholder: "Ressource auswählen..."
- "Anlegen" / "Abbrechen"

## Config & Week Panels

- **Config panel**: Per-day enabled/start/end rules per resource, saved via `POST /config`
- **Week panel**: Year/week inputs, generates offerings from configs, `POST /week`

## Grid State Preservation

Same pattern as appointments: `_offset`, `_sort`, `_order`, `_filter` via `GridStateHiddenInputs` + `gridStateToParams()`.

## Related

- [Admin Offerings CRUD](./admin-offerings-crud.md) — Controller, route setup, error handling
- [Admin Appointments UI](./admin-appointments-ui.md) — Similar grid pattern (appointments variant)
- [Inline CRUD Pattern](./inline-crud-pattern.md) — Sidebar edit/create form details
