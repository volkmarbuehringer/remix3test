<!-- Context: project-intelligence/newapp/lookup/shared-utilities | Priority: medium | Version: 1.0 | Updated: 2026-05-25 -->

# Lookup: Appointment Shared Utilities

Quick reference for shared utility functions used across appointment components.

---

## `readAppointmentData()`

Reads page state from the embedded `<script id="appointment-data">` JSON tag.

**File**: `app/utils/appointment.ts` (lines 33-41)

```tsx
export function readAppointmentData(): Record<string, unknown>
```

**Returns**: Parsed JSON object or `{}` on error.

| Scenario | Return |
|----------|--------|
| SSR (no `document`) | `{}` (caught by try-catch) |
| Client, element missing | `{}` |
| Client, JSON parse error | `{}` |
| Client, valid data | Typed `Record<string, unknown>` |

### Data Shape (as typed by `readData()` wrappers)

```tsx
type AppointmentPageData = {
  year: number
  week: number
  weekStart: number
  days: Array<{ dayName: string; date: number; dateStr: string }>
  appointments: Array<{
    id: number; user_id: number; resource_id: number
    title: string; date: number; start_min: number; end_min: number
  }>
  offerings: Array<{ day: number; start_min: number; end_min: number }>
  resources: Array<{ id: number; description: string }>
  csrfToken: string
  currentUserId: number
  selectedResourceId: number
}
```

### Wrapper Functions

Each component casts the `Record<string, unknown>` to its specific shape:

| Component | Wrapper | Lines |
|-----------|---------|-------|
| `appointment-grid.tsx` | `readData()` — casts to `AppData` | 119-130 |
| `appointment-sidebar.tsx` | `readData()` — picks year, week, weekStart, resources | 19-34 |

Both use `??` defaults to handle missing keys.

---

## `formatDateRange()`

Formats an ISO week Monday–Sunday range as a human-readable string.

**File**: `app/utils/appointment.ts` (lines 54-61)

```tsx
export function formatDateRange(mondayMs: number): string
```

| Input | Output |
|-------|--------|
| `1711209600000` (Mar 24, 2025) | `"Mar 24 – Mar 30, 2025"` |
| `0` or falsy | `""` |

**Algorithm**: Takes epoch-ms for Monday 00:00 UTC. Adds `6 × 86400000` for Sunday. Formats with short month names (`Jan`–`Dec`) and UTC dates.

### Usage

Used by `appointment-sidebar.tsx` to show the current week's date range in the sidebar header:

```tsx
// appointment-sidebar.tsx line 50
let weekDateRange = weekStart ? formatDateRange(weekStart) : ''
```

The appointment page also has its own `formatDateRange()` at `app/ui/appointment-page.tsx:11-18` — this is a server-side copy used during SSR render (the utility version is client-only).

> **Note**: The server-side copy in `appointment-page.tsx` (lines 11-18) duplicates the logic for SSR. Both implementations use the same algorithm but the utility version is imported in clientEntry components.

---

## Data Source: Server-Embedded JSON

The data is embedded by the server in `appointment-page.tsx`:

```tsx
// app/ui/appointment-page.tsx — lines 51-67
let data = JSON.stringify({ year, week, weekStart, days, appointments, offerings, ... })
// ...
<script id="appointment-data" type="application/json">{data}</script>
```

Both `clientEntry` components read from this one tag during client-side render.

---

## 📂 Codebase References

| File | Lines | Purpose |
|------|-------|---------|
| `app/utils/appointment.ts` | 33-41 | `readAppointmentData()` — DOM JSON reader |
| `app/utils/appointment.ts` | 54-61 | `formatDateRange()` — week range formatter |
| `app/utils/appointment.ts` | 8-27 | `AppointmentPageData` type |
| `app/ui/appointment-grid.tsx` | 119-130 | `readData()` wrapper — casts to AppData |
| `app/ui/appointment-sidebar.tsx` | 4 | Import of both utilities |
| `app/ui/appointment-sidebar.tsx` | 19-34 | `readData()` wrapper — picks fields for sidebar |
| `app/ui/appointment-page.tsx` | 11-18 | Server-side `formatDateRange()` duplicate |
| `app/ui/appointment-page.tsx` | 51-67 | Data embedding in script tag |

## Related

- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Server-embedded JSON section
- [Appointment Grid SSR Hydration](../concepts/appointment-hydration.md) — Why readData() needs SSR guard
- [Performance Patterns](../concepts/performance-patterns.md) — How slots data is consumed
