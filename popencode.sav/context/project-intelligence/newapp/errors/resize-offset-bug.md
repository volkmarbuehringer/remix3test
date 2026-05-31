<!-- Context: project-intelligence/newapp/errors/resize-offset-bug | Priority: high | Version: 1.0 | Updated: 2026-05-25 -->

# Error: Resize Jump on Non-Midnight Offering Start

**Symptom**: Resizing an appointment block via the end handle causes the block to jump to the full column height immediately on pointerdown. Drag works correctly, only resize is affected.

---

## Root Cause

The `offsetY` calculation in `startResize()` did not subtract `currentOfferingStartMin` when computing the handle's visual position.

### How Positioning Works

Grid rows begin at `currentOfferingStartMin` (e.g., minute 480 = 8:00), not at midnight. All block positions are relative to this offset:

```tsx
// Block top position in render (line 391):
let topPx = ((appt.start_min - currentOfferingStartMin) / 60) * SLOT_HEIGHT
```

`SLOT_HEIGHT = 160` pixels per hour. An appointment ending at 10:00 (600 min) with offering start at 8:00 (480 min) has a visual end at:
```
(600 - 480) / 60 * 160 = 320px
```

### The Bug

The resize `offsetY` was calculated with raw `end_min` — no offering offset:

```tsx
// BUG (conceptual):
offsetY: event.clientY - (grid.top + (appt.end_min / 60) * grid.rowHeight)
//                                    ^^^^^^^^ no currentOfferingStartMin subtraction
```

With `currentOfferingStartMin = 480` and `end_min = 600`:
```
offsetY = clientY - (grid.top + 600/60 * 160)
        = clientY - (grid.top + 1600)
```

But the actual block end is at `320px` (600-480). The offset was **1280 pixels too high**, causing:
1. `pointerToResizeMinute()` to calculate a very large edge minute
2. The resize result to be clamped to the column maximum
3. **Perceived jump**: block immediately resizes to full column height

### Why Drag Was Correct

The drag `startDrag()` computes offset relative to the block's **top-left corner**:

```tsx
// line 752:
let blockTop = grid.top + ((appt.start_min - currentOfferingStartMin) / 60) * grid.rowHeight
//                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ✅ subtracts offering offset
```

Drag always used the offering offset. Resize did not — the bug was in the `edge === 'end'` branch of `startResize()`.

## The Fix

Subtract `currentOfferingStartMin` from the edge minute before converting to pixels:

```tsx
// FIX — line 1015:
offsetY: event.clientY - (grid.top + (
  (edge === 'end' ? appt.end_min : appt.start_min) - currentOfferingStartMin
) / 60 * grid.rowHeight),
```

This makes resize offset calculation consistent with drag and render positioning.

## Prevention

When writing gesture handlers that convert pixel positions to time values:

1. **Identify the coordinate system**: Are positions relative to grid origin (offering start) or absolute (midnight)?
2. **Check consistency**: Render positions, drag offsets, resize offsets, and pointer-to-minute conversions must all use the same origin
3. **Test with non-zero offering start**: Always test with `currentOfferingStartMin > 0` (e.g., 8:00 = 480) to catch offset errors
4. **Pattern**: If render divides by `SLOT_HEIGHT` after `(minute - offset)`, gesture handlers must also subtract the same offset

## 📂 Codebase References

| File | Lines | Purpose |
|------|-------|---------|
| `app/ui/appointment-grid.tsx` | 999-1030 | `startResize()` — the bug and fix are here (line 1015) |
| `app/ui/appointment-grid.tsx` | 743-771 | `startDrag()` — correct offset for comparison |
| `app/ui/appointment-grid.tsx` | 391 | Render position: `(appt.start_min - currentOfferingStartMin)` |
| `app/ui/appointment-grid.tsx` | 1282-1292 | `pointerToResizeMinute()` — converts edge Y to minute |
| `app/ui/appointment-grid.tsx` | 1261-1280 | `pointerToPlacement()` — drag pointer-to-minute (correct) |
| `app/ui/appointment-grid.tsx` | 222-223 | `currentOfferingStartMin` / `currentOfferingEndMin` storage |

## Related

- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Grid constants, 15-min snap, SLOT_HEIGHT
- [Drag & Resize Gestures (Remix 3)](../../../development/remix3/guides/drag-resize-gestures.md) — Gesture state machine
- [Performance Patterns (Set/Map)](../concepts/performance-patterns.md) — Offering time range computation
- [Known Issues](../lookup/known-issues.md) — Other appointment bugs and limitations
