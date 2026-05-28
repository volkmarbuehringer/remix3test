<!-- Context: project-intelligence/newapp/guides/admin-appointments-ui | Priority: high | Version: 1.1 | Updated: 2026-05-28 -->

# Guide: Admin Appointments UI

**Purpose**: UI components for the admin appointments CRUD grid — grid page, edit/create sidebar forms, grid state preservation pattern, and SSE connection indicator.

---

## Grid Page (`app/ui/admin-appointments-page.tsx`)

Single-page component that conditionally renders in one or two columns:

- **Toolbar**: "+ Neu" button with `rmx-target={frames.adminContent}`
- **Filter bar**: GET form with text input, submit button, conditional "Zurücksetzen" link
- **Table**: 8 sortable columns (ID, Titel, Benutzer, Ressource, Datum, Zeit, Erstellt, Aktualisiert)
- **Action cells**: Edit glyph link + `RestfulForm method="DELETE"` with trash glyph
- **Pagination**: Offset-based, "Zurück"/"Weiter" links, shows "Zeige N–M"
- **Empty states**: `Keine Termine gefunden` (with filter) / `Keine Termine vorhanden` (without)
- **Two-column layout**: `gridTemplateColumns: '1fr 380px'` with sticky sidebar when editing/creating
- **SSE connection indicator**: `ConnectionIndicator` in the header bar (see below)

### SSE Connection Indicator

The `ConnectionIndicator` appears in the page header bar, next to the "Appointments" title, in both the single-column and two-column layouts:

```tsx
<div mix={headerBarStyle}>
  <h2>Appointments</h2>
  <ConnectionIndicator
    url="/admin/appointments/events"
    reloadMode="frame"
    skipReloadParams={['editing', 'creating']}
  />
</div>
```

Configuration details:
- **`reloadMode: 'frame'`** — The admin page renders inside a Remix Frame. On `invalidate`, the indicator calls `handle.frame.reload()` to refresh only the frame content, not the whole page.
- **`skipReloadParams: ['editing', 'creating']`** — When the sidebar edit/create form is open (indicated by `?editing=<id>` or `?creating=true` in the URL), `invalidate` events are suppressed. This prevents the form from being reloaded mid-edit.
- **Positioning**: In-flow in the flex header bar (not sticky). The bar is always visible since the admin page layout fits within its Frame.

The underlying SSE channel is the same `appointmentChannel` used by the public appointment page — mutations from either side broadcast to all sessions.

### SSE Endpoint

| Detail | Value |
|--------|-------|
| Route | `/admin/appointments/events` |
| Controller action | `events` in `admin-appointments-controller.tsx` |
| Channel | `appointmentChannel.subscribe(request)` |
| Broadcast | `appointmentChannel.broadcast('invalidate')` after create/update/delete |

## Format Helpers

| Helper | Input | Output |
|--------|-------|--------|
| `formatDate(date)` | BIGINT ms | `DD.MM.YYYY` (de-DE) |
| `formatDuring(during)` | `"[start,end)"` | `HH:MM–HH:MM` |
| `formatTimestamp(ts)` | BIGINT ms | `DD.MM.YYYY, HH:MM` (de-DE) |

## Edit Form (`app/ui/admin-appointments-edit-page.tsx`)

`RestfulForm method="PUT" action="/admin/appointments/:id"` with:

- Resource dropdown, user dropdown, title input, date input, start/end time dropdowns
- Pre-selects current values via `selected={...}` 
- ID badge (`#<id>`) in panel header
- "Speichern" / "Abbrechen" buttons
- `GridStateHiddenInputs` for state preservation
- `animateEntrance` on mount

## Create Form (`app/ui/admin-appointments-create-page.tsx`)

`RestfulForm method="POST" action="/admin/appointments"` with:

- Same form layout as edit (resource, user, title, date, start/end time)
- Start time defaults to `08:00` (minute 480), end time to `17:00` (minute 1020)
- Placeholder options: "Ressource auswählen..." / "Benutzer auswählen..."
- "Anlegen" / "Abbrechen" buttons

## Grid State Preservation

All forms carry 4 hidden fields via `GridStateHiddenInputs`:

| State | Form Hidden | URL Param |
|-------|-------------|-----------|
| Offset | `_offset` | `offset` |
| Sort column | `_sort` | `sort` |
| Sort direction | `_order` | `order` |
| Filter text | `_filter` | `filter` |

Flow: grid → edit/create form → save → redirect preserves state via `gridStateToParams()` / `parseSort()`.

## Key UI Differences from Admin Offerings

| Aspect | Offerings | Appointments |
|--------|-----------|-------------|
| "Add New" button | `+ Add New` | `+ Neu` |
| Form fields | resource, day, start, end | resource, user, title, date, start, end |
| User dropdown | None | Full users table |
| Search scope | resource only | title + user + resource |

## Related

- [Admin Appointments CRUD](./admin-appointments-crud.md) — Controller, route setup, error handling
- [Grid State Hidden Inputs](../guides/grid-state-hidden.md) — Component reference
- [Admin Filter Pattern](./admin-filter-pattern.md) — ILIKE filter on admin pages
