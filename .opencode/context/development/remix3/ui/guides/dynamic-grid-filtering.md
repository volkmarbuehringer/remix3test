<!-- Context: development/remix3/ui/guides/dynamic-grid-filtering | Priority: high | Version: 1.0 | Updated: 2026-05-25 -->

# Guide: Dynamic Grid Filtering by Offerings

**Purpose**: The appointment grid dynamically adapts its columns and rows based on which days and time ranges have offerings. Days without offerings are hidden; time rows without bookable slots are omitted; non-offering slots get distinct visual treatment.

---

## Overview

The appointment grid uses CSS grid with `gridTemplateColumns` computed from the number of visible days. Offerings data controls three aspects dynamically:

1. **Which day columns appear** — only days with ≥1 offering
2. **Which time rows render** — only 15-min intervals within any offering across all visible days
3. **Per-slot bookability** — individual slots show red diagonal stripes if not covered by any offering

---

## Core Computations

### `computeVisibleDays()` — Column Filtering

```tsx
function computeVisibleDays(
  days: AppData['days'],
  offerings: AppData['offerings'],
): AppData['days'] {
  return days.filter((d) => offerings.some((o) => o.day === d.date))
}
```

Returns only the days from the 7-day week that have at least one offering. The count drives `gridTemplateColumns`:

```tsx
let numDays = visibleDays.length
let gridTemplateCols = `${LABEL_WIDTH}px repeat(${numDays}, 1fr)`
```

Both the header row and grid body use this dynamic template — unlike the static `repeat(7, 1fr)` that would be needed without offerings.

### `computeAllBookableMinutes()` — Row Filtering

```tsx
function computeAllBookableMinutes(
  offerings: AppData['offerings'],
  visibleDays: AppData['days'],
): number[] {
  let set = new Set<number>()
  let visibleDates = new Set(visibleDays.map((d) => d.date))
  for (let o of offerings) {
    if (!visibleDates.has(o.day)) continue
    for (let m = o.start_min; m < o.end_min; m += 15) {
      set.add(m)
    }
  }
  return [...set].sort((a, b) => a - b)
}
```

Computes the **union** of all 15-min intervals across all visible days. Only these minutes render as rows. For example, if offerings cover 8:00–18:00 Mon–Fri, this produces 480, 495, 510, ..., 1065, 1080 — 40 rows per day.

The time column and each day column iterate over this sorted array, not over all 96 quarter-hours.

### `computeOfferingTimeRange()` — Height Computation

```tsx
function computeOfferingTimeRange(
  offerings: AppData['offerings'],
): { startMin: number; endMin: number } {
  if (offerings.length === 0) return { startMin: 0, endMin: 1440 }
  let startMin = Math.min(...offerings.map((o) => o.start_min))
  let endMin = Math.max(...offerings.map((o) => o.end_min))
  // Snap to 15-min boundaries
  startMin = Math.floor(startMin / 15) * 15
  endMin = Math.ceil(endMin / 15) * 15
  return { startMin, endMin }
}
```

Used to set `min-height` on each day column — prevents the column from being shorter than the offering range:

```tsx
style={`min-height: ${(offeringRange.endMin - offeringRange.startMin) / 60 * SLOT_HEIGHT}px;`}
```

### `isSlotInAnyOffering()` — Per-Slot Bookability

```tsx
function isSlotInAnyOffering(
  date: number,
  minute: number,
  offerings: AppData['offerings'],
): boolean {
  return offerings.some(
    (o) => o.day === date && minute >= o.start_min && minute < o.end_min,
  )
}
```

Checks if a specific 15-min slot is covered by any offering on that day. Used to apply the `nonOfferingSlotStyle`:

```tsx
mix={[
  isHour ? hourLineStyle : subHourLineStyle,
  bookable ? undefined : nonOfferingSlotStyle,
  bookable ? on('click', () => startDraft(dayIdx, minute)) : undefined,
]}
```

Non-bookable slots:
- Get red diagonal stripe background
- Lose the click handler (no draft creation)
- Get `cursor: default`

---

## `currentVisibleDays` Module-Level Pattern

A module-level variable tracks the computed visible days for event handler access:

```tsx
// In the render closure — updated each render:
currentVisibleDays = visibleDays
currentVisibleDayDates = visibleDays.map((d) => d.date)
```

This is necessary because event handlers (drag, resize, type-drag) fire outside the render cycle and need access to the current day index mapping. The variable is updated at the top of the render function before any event handler can use it.

**Used in:**
- `startDrag()` — finds day index from `appt.date`:
  ```tsx
  let dayIdx = currentVisibleDays.findIndex((d) => d.date === appt.date)
  ```
- `pointerToPlacement()` — converts pointer X to day index:
  ```tsx
  let dayIdx = clamp(Math.round(rawDay), 0, days.length - 1)
  ```
- `measureGrid()` — computes day width from visible day count:
  ```tsx
  let numDays = currentVisibleDays.length || 1
  dayWidth: Math.max(1, (rect.width - LABEL_WIDTH) / numDays),
  ```
- `moveDrag()` — snap to day column during drag
- `onTypeDragMove()` — snap type-drag preview to visible day

---

## nonOfferingSlotStyle — Red Diagonal Stripes

```tsx
const nonOfferingSlotStyle = css({
  backgroundColor: 'rgb(254 226 226 / 0.55)',
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 8px, rgb(252 165 165 / 0.3) 8px, rgb(252 165 165 / 0.3) 16px)',
  cursor: 'default',
  borderTop: `1px solid rgb(252 165 165 / 0.6)`,
  '&:hover': {
    backgroundColor: 'rgb(252 165 165 / 0.5)',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgb(239 68 68 / 0.25) 8px, rgb(239 68 68 / 0.25) 16px)',
  },
})
```

**Effect:**
- Light red background (`rgb(254 226 226)`)
- 45° diagonal repeating gradient in the red family
- Red-tinted top border
- `cursor: default` (not clickable)
- Darker red on hover (no click handler either)

This clearly distinguishes non-bookable times (before 8:00, after 18:00, weekends) from bookable slots.

---

## Empty State

When no offerings exist for the entire week, the grid renders a centered message instead of an empty grid:

```tsx
if (hasNoOfferings) {
  return (
    <div mix={emptyStateWrapperStyle}>
      <p mix={emptyStateTextStyle}>No bookable slots this week.</p>
    </div>
  )
}
```

`hasNoOfferings` is true when `visibleDays.length === 0 || offerings.length === 0`.

---

## Type-Drag Integration with Dynamic Grid

The type-drag interaction (`onTypeDragMove`) also uses `currentVisibleDays` to compute the snapped day index:

```tsx
let rawDay = (event.clientX - grid.left - grid.labelWidth) / grid.dayWidth
let dayIdx = clamp(Math.round(rawDay), 0, currentVisibleDays.length - 1)
let date = currentVisibleDays[dayIdx]?.date
```

The day count changed from the static 7 to `currentVisibleDays.length`. The `clamp` ensures the pointer cannot snap to a non-existent column.

---

## Updating `pointerToPlacement` for Variable Column Count

`pointerToPlacement()` was updated from a hardcoded 7-day assumption to use the `days` parameter:

```tsx
function pointerToPlacement(
  event: PointerEvent,
  grid: GridMeasurement,
  days: AppData['days'],
): { date: number; startMinute: number } | null {
  let blockLeft = event.clientX - (dragState?.offsetX ?? 0)
  let blockTop = event.clientY - (dragState?.offsetY ?? 0)

  let rawDay = (blockLeft - grid.left - grid.labelWidth) / grid.dayWidth
  let dayIdx = clamp(Math.round(rawDay), 0, days.length - 1)
  let date = days[dayIdx]?.date
  if (!date) return null

  let rawMinute = ((blockTop - grid.top) / grid.rowHeight) * 60
  let snappedMinute = Math.round(rawMinute / 15) * 15
  let startMinute = clamp(snappedMinute, 0, 24 * 60 - 15)

  return { date, startMinute }
}
```

The `days` parameter is always `currentVisibleDays`, which excludes non-offering days. The day index logic now maps to visible columns only.

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/ui/appointment-grid.tsx` | 128-130 | `computeVisibleDays()` |
| `app/ui/appointment-grid.tsx` | 132-140 | `computeOfferingTimeRange()` |
| `app/ui/appointment-grid.tsx` | 142-148 | `isSlotInAnyOffering()` |
| `app/ui/appointment-grid.tsx` | 154-164 | `computeAllBookableMinutes()` |
| `app/ui/appointment-grid.tsx` | 204-206 | `currentVisibleDays` module-level variable |
| `app/ui/appointment-grid.tsx` | 241-243 | `currentVisibleDays` assignment in render |
| `app/ui/appointment-grid.tsx` | 263-269 | Empty state: "No bookable slots this week." |
| `app/ui/appointment-grid.tsx` | 272 | Dynamic `gridTemplateColumns` from visible day count |
| `app/ui/appointment-grid.tsx` | 343-356 | Row rendering with `isSlotInAnyOffering` check |
| `app/ui/appointment-grid.tsx` | 1604-1612 | `nonOfferingSlotStyle` CSS |
| `app/ui/appointment-grid.tsx` | 1144 | Type-drag: `clamp` using `currentVisibleDays.length` |
| `app/ui/appointment-grid.tsx` | 1210-1220 | `measureGrid()` using `currentVisibleDays.length` |
| `app/ui/appointment-grid.tsx` | 1224-1242 | `pointerToPlacement()` with dynamic day count |
| `app/ui/appointment-grid.tsx` | 718 | `startDrag()` with `currentVisibleDays.findIndex` |
| `app/ui/appointment-page.tsx` | 40-49 | Client-side offering normalization |
| `app/lib/math.ts` | 1-3 | `clamp()` utility |

## Related

- [AppointOffering Concept](../../../../project-intelligence/newapp/concepts/appointoffering.md) — Server-side offering model
- [AppointOffering CRUD Guide](../../../../project-intelligence/newapp/guides/appointoffering-crud.md) — Data access functions
- [Appointment Calendar Architecture](../../../../project-intelligence/newapp/concepts/appointment-calendar.md) — Full calendar system
- [Remix UI Patterns](../guides/patterns.md) — CSS grid, state management, data loading
