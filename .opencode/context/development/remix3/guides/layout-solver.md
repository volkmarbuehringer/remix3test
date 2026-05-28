<!-- Context: development/remix3/guides/layout-solver | Priority: medium | Version: 1.1 | Updated: 2026-05-25 -->

# Guide: Pure-Function Layout Solver

**Purpose**: Detect and resolve block overlaps in a 2D calendar grid using a cost-based algorithm — no DOM dependencies, no side effects.

---

## When to Use

- Calendar/time-grid UIs with blocks that can move or resize
- Need collision resolution (overlapping blocks get shifted automatically)
- Want a pure function that's independently testable from UI

**Don't use**: Static layouts where blocks never overlap. Simple non-overlapping grids.

---

## Key Interfaces

```tsx
interface AppointmentLayoutBlock {
  date: number      // epoch ms of midnight (UTC)
  start_min: number // minutes from midnight (0–1440)
  end_min: number   // 0–1440
  id: number
  title: string
}

interface LayoutPolicy {
  dayMinutes: number       // 1440 (24h)
  minimumMinute: number    // 0
  minimumDuration: number  // 15 (15 min default)
  slotMinutes: number      // 15 (snap granularity)
}

interface LayoutResult {
  blocks: AppointmentLayoutBlock[]  // new layout
  changes: LayoutChange[]           // what changed vs original
  unresolved: boolean               // true if solver gave up
}

type LayoutChangeKind = 'created' | 'deleted' | 'moved' | 'resized'

interface LayoutChange {
  id: number
  kind: LayoutChangeKind
  before?: AppointmentLayoutBlock
  after?: AppointmentLayoutBlock
}
```

---

## Core Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `previewMoveBlock(blocks, blockId, { date, startMinute })` | Preview moving a block to a new day/time | `LayoutResult` |
| `previewResizeBlockTime(blocks, blockId, { edge, minute })` | Preview resizing from `start` or `end` edge | `LayoutResult` |
| `previewDeleteBlock(blocks, blockId)` | Preview removing a block | `LayoutResult` |

All three are **pure** — they receive source blocks and return a new layout. They never mutate the input.

---

## Algorithm: Cost-Based Collision Resolution

When a moved/resized block would overlap others, the solver tries every insertion position in the target day and scores each candidate:

1. **Minimize moved blocks** (fewest blocks shifted from original position)
2. **Minimize total distance** (sum of minutes shifted across all blocks)
3. **Minimize natural index distance** (closest to where the block "naturally" fits)

```tsx
candidates.sort(
  (left, right) =>
    left.movedCount - right.movedCount ||
    left.totalDistance - right.totalDistance ||
    left.naturalDistance - right.naturalDistance,
)
```

### Layout strategy per candidate:

- **`layoutBeforeAnchor`**: Walk blocks in reverse from anchor start, packing them upward toward `minimumMinute`
- **`layoutAfterAnchor`**: Walk blocks forward from anchor end, packing them downward toward `dayMinutes`
- If either pack fails (hits boundary), the candidate is rejected

### Horizontal day swap optimization:

If the block moves to a day where it exactly overlaps one existing block at the same start time, the solver **swaps** the two blocks instead of general collison resolution — this handles the common case of swapping appointments between days.

---

## Important Caveats

- **`unresolved === true`**: The solver couldn't find a valid layout — caller should reject the drop/resize and revert to original positions
- **Snap behavior**: `clampMinute()` snaps to `policy.slotMinutes` (default 15). The UI should compute pointer positions in grid coordinates before calling the solver
- **Mutability**: The solver copies blocks internally, but the `changes` array in `LayoutResult` references *copies* — use `changes` only for diffing, not for direct state mutation
- **Performance**: O(n²) worst-case, but realistic grids (<20 blocks/week) complete in <1ms. Keep synchronous — don't yield to event loop
- **Minimum duration**: The solver's `isValidBlock()` enforces `policy.minimumDuration` (default 15). Any block shorter than that is invalid. The controller also validates `end_min - start_min >= 15` for both create and update actions.

---

## Example: Using `previewMoveBlock`

```tsx
import { previewMoveBlock } from './schedule-layout.ts'

// On drag move:
let nextPreview = previewMoveBlock(
  originalBlocks,    // snapshot of all blocks at drag start
  dragState.blockId, // which block is being dragged
  { date: targetDate, startMinute: snappedMinute },
)

if (nextPreview.unresolved) {
  // Cannot resolve — don't update preview (stay at last valid position)
  return
}

preview = nextPreview  // update preview for ghost block rendering
handle.update()
```

---

## 📂 Codebase References

| File | Role |
|------|------|
| `newapp/app/ui/schedule-layout.ts` | Full implementation (481 lines) — all exported + internal functions |
| `newapp/app/ui/appointment-grid.tsx` | Consumer — calls solver in `moveDrag()`, `moveResize()`, `endDrag()`, `endResize()` |

## Related

- [Drag & Resize Gestures](./drag-resize-gestures.md) — The UI gesture layer that calls the layout solver
- [Weekly Grid Pattern](./appointment-grid.md) — CSS grid layout that renders the solver results
- [Timeboxer Demo](../../project-intelligence/newapp/concepts/timeboxer.md) — Original source of the adapted solver
