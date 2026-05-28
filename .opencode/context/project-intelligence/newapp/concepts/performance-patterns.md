<!-- Context: project-intelligence/newapp/concepts/performance-patterns | Priority: medium | Version: 1.0 | Updated: 2026-05-25 -->

# Concept: Appointment Grid Performance Patterns

**Core Idea**: Two algorithmic optimizations for the weekly grid — Set-based O(1) slot bookability checks and Map-based O(n) appointment grouping — replacing linear scans that would be O(n × m).

---

## Pattern 1: Set-based O(1) Slot Bookability

### Problem

The grid renders 96 quarter-hour rows per day column. Each row needs to know if that 15-min slot is bookable (has an offering). Naive approach: `offerings.some()` per cell = O(numCells × numOfferings) = up to 96 × 7 × offerings.

### Solution

Precompute a per-day `Set<minute>` of all bookable 15-min minutes:

```tsx
// app/ui/appointment-grid.tsx — lines 151-176
function computeBookableSlots(
  offerings: AppData['offerings'],
  visibleDays: AppData['days'],
): { allBookableMinutes: number[]; bookableByDay: Map<number, Set<number>> } {
  let visibleDates = new Set(visibleDays.map((d) => d.date))
  let byDay = new Map<number, Set<number>>()
  let globalSet = new Set<number>()

  for (let o of offerings) {
    if (!visibleDates.has(o.day)) continue
    let daySet = byDay.get(o.day)
    if (!daySet) {
      daySet = new Set<number>()
      byDay.set(o.day, daySet)
    }
    for (let m = o.start_min; m < o.end_min; m += 15) {
      daySet.add(m)
      globalSet.add(m)
    }
  }

  return {
    allBookableMinutes: [...globalSet].sort((a, b) => a - b),
    bookableByDay: byDay,
  }
}
```

**Two outputs**:
- `allBookableMinutes` — Sorted array of all bookable minutes across ALL visible days (used for rendering row labels, only shows rows where at least one day has a bookable slot)
- `bookableByDay` — Per-day Set for O(1) cell bookability checks

### Usage in Render

```tsx
// line 374 — O(1) check per cell:
let bookable = dayBookable?.has(minute) ?? false
```

Without this, each cell would need `offerings.some(o => o.day === date && o.start_min <= minute && o.end_min > minute)` — a full linear scan per cell per render.

---

## Pattern 2: Map-based O(n) Appointment Grouping

### Problem

Each day column needs its appointments rendered at the correct position. Naive nested loop: for each day, scan all appointments to find matches = O(days × appointments).

### Solution

Build a `Map<date, blocks[]>` in one pass, then group by day:

```tsx
// app/ui/appointment-grid.tsx — lines 276-284
let byDate = new Map<number, AppointmentLayoutBlock[]>()
for (let appt of sourceBlocks) {
  let list = byDate.get(appt.date)
  if (!list) {
    list = []
    byDate.set(appt.date, list)
  }
  list.push(appt)
}
let groups = visibleDays.map((d) => byDate.get(d.date) ?? [])
```

**One O(n) pass** through all appointments builds the Map. Day grouping is O(days) — just looking up pre-grouped arrays.

---

## Additional Optimization: Visible Day Filtering

`computeVisibleDays()` filters days to only those with at least one offering:

```tsx
// line 132-134
function computeVisibleDays(days, offerings): AppData['days'] {
  return days.filter((d) => offerings.some((o) => o.day === d.date))
}
```

This runs once per render and is used as a gate — if zero visible days, the grid shows a "No bookable slots this week" message immediately without attempting further computations.

---

## Performance Impact Summary

| Optimization | Before | After | Improvement |
|-------------|--------|-------|-------------|
| Slot bookability | O(cells × offerings) O(10,000+) | O(cells) per render + O(offerings × minutes) once | Eliminates per-cell linear scan |
| Appointment grouping | O(days × appointments) | O(n) one-pass + O(days) lookup | Eliminates nested loop |
| Visibility filter | No early exit | O(days × offerings) early check | Prevents rendering empty grid |

## 📂 Codebase References

| File | Lines | Purpose |
|------|-------|---------|
| `app/ui/appointment-grid.tsx` | 151-176 | `computeBookableSlots()` — Set-based O(1) lookup |
| `app/ui/appointment-grid.tsx` | 132-134 | `computeVisibleDays()` — day filtering |
| `app/ui/appointment-grid.tsx` | 136-144 | `computeOfferingTimeRange()` — start/end min bounds |
| `app/ui/appointment-grid.tsx` | 264 | Usage: calls all three compute functions |
| `app/ui/appointment-grid.tsx` | 276-285 | Map-based appointment grouping per day |
| `app/ui/appointment-grid.tsx` | 374 | O(1) bookable check: `bookableByDay.get(date)?.has(minute)` |

## Related

- [Appointment Calendar Architecture](./appointment-calendar.md) — Grid rendering, offerings, SLOT_HEIGHT constants
- [Drag & Resize Gestures (Remix 3)](../../../development/remix3/guides/drag-resize-gestures.md) — Gesture state machine references same data
