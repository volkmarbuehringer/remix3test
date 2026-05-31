<!-- Context: development/remix3/guides/drag-resize-gestures | Priority: medium | Version: 1.1 | Updated: 2026-05-25 -->

# Guide: Closure-Based Gesture State Machine (Drag & Resize)

**Purpose**: Implement drag-and-drop and resize gestures in a `clientEntry` component using closure-scoped state, window-level pointer events, and a layout solver for collision resolution.

---

## When to Use This Pattern

**Do**: One-off complex gesture in a single component, tightly coupled to component state, needs window-level event capture, uses pure-function solver for collision resolution.

**Don't**: Gesture reused across multiple components (use `createMixin` instead). Native events are sufficient (use `on()` mixin instead).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  closure state (dragState / resizeState / preview)  │
├─────────────────────────────────────────────────────┤
│  handleBlockPointerDown() ─── dispatch to drag      │
│  startDrag() / startResize()  ─── init state        │
│  moveDrag() / moveResize()   ─── call layout solver │
│  endDrag() / endResize()     ─── save & reload      │
│  cancelDrag() / cancelResize() ── revert state      │
├─────────────────────────────────────────────────────┤
│  bindWindowEvents() ── window pointermove/up/cancel │
│  measureGrid() ── getBoundingClientRect snapshot     │
│  pointerToPlacement() / pointerToResizeMinute()      │
└─────────────────────────────────────────────────────┘
         ↕  calls
┌─────────────────────┐
│  layout-solver.ts   │  ← pure function, no DOM
│  previewMoveBlock() │
│  previewResize()    │
└─────────────────────┘
```

---

## Gesture State Types

```tsx
type GestureKind = 'drag' | 'resize'

type DragState = {
  active: boolean
  blockId: number
  grid: GridMeasurement
  moved: boolean               // exceeded DRAG_THRESHOLD?
  offsetX: number              // pointer offset from block top-left
  offsetY: number
  originalBlocks: AppointmentLayoutBlock[]  // snapshot at drag start
  placement: { date: number; startMinute: number }
  pointerId: number
  startX: number               // for distance threshold
  startY: number
}

type ResizeState = {
  active: boolean
  blockId: number
  edge: 'start' | 'end'
  grid: GridMeasurement
  moved: boolean
  offsetY: number              // pointer offset from block top
  originalBlock: AppointmentLayoutBlock  // snapshot at resize start
  originalBlocks: AppointmentLayoutBlock[]
  pointerId: number
  startY: number
}

type GridMeasurement = {
  dayWidth: number              // (container.width - LABEL_WIDTH) / 7
  labelWidth: number            // 56px
  left: number                  // container.getBoundingClientRect().left
  rowHeight: number             // SLOT_HEIGHT (160px — 4x scale for 15-min precision)
  top: number                   // container.getBoundingClientRect().top
}
```

State lives in the `clientEntry` closure (not returned JSX). All gesture state is reset on page reload.

---

## Lifecycle: Start → Move → End / Cancel

### Start

```tsx
function startDrag(appt, event) {
  if (!gridBodyElement) return

  let grid = measureGrid(gridBodyElement) // snapshot at start
  // Compute block position for offset calculation
  let blockLeft = grid.left + grid.labelWidth + dayIdx * grid.dayWidth
  let blockTop = grid.top + (appt.start_min / 60) * grid.rowHeight

  dragState = {
    active: true,
    blockId: appt.id,
    grid,                         // frozen at start — don't re-measure
    moved: false,
    offsetX: event.clientX - blockLeft,
    offsetY: event.clientY - blockTop,
    originalBlocks: data.appointments.map(copyAppt), // snapshot!
    placement: { date: appt.date, startMinute: appt.start_min },
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
  }
  activeGesture = 'drag'
  bindWindowEvents()              // add window listeners
  handle.update()
}
```

**Key**: `originalBlocks` is snapshotted at start. `grid` is snapshotted at start (no re-measure during drag, since scrolling would shift coordinates).

### Move

```tsx
function moveDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return

  // Threshold guard — prevents drag-start on tiny movements
  let distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
  if (!dragState.moved && distance < DRAG_THRESHOLD) return

  dragState.moved = true
  let nextPlacement = pointerToPlacement(event, dragState.grid, data.days)
  if (!nextPlacement) return

  // Compute visual offset for sub-cell snapping
  // ... (translate transform on dragged block)

  // Only call solver if placement actually changed
  if (nextPlacement === dragState.placement) { handle.update(); return }

  let nextPreview = previewMoveBlock(dragState.originalBlocks, dragState.blockId, nextPlacement)
  if (nextPreview.unresolved) { handle.update(); return }   // reject invalid positions

  dragState.placement = nextPlacement
  preview = nextPreview
  handle.update()
}
```

### End

```tsx
async function endDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return
  unbindWindowEvents()

  let finalPreview = dragState.moved && preview && !preview.unresolved ? preview : null

  // Reset visual state before async save
  dragState = null
  activeGesture = null
  draggedBlockOffset = { x: 0, y: 0 }

  if (finalPreview) {
    // Save ALL changed blocks — batch parallel PUTs, reload on any success
    let saves = finalPreview.changes
      .filter(c => (c.kind === 'moved' || c.kind === 'resized') && c.after)
      .map(c => saveBlockPosition(c.id, c.after!, csrfToken))

    preview = null
    handle.update()

    let results = await Promise.allSettled(saves)
    if (results.some(r => r.status === 'fulfilled' && r.value.ok)) {
      window.location.reload()
    }
    return
  }

  preview = null
  handle.update()
}
```

### Cancel

```tsx
function cancelDrag() {
  unbindWindowEvents()
  draggedBlockOffset = { x: 0, y: 0 }
  preview = null
  dragState = null
  activeGesture = null
  handle.update()
}
```

---

## Guards

The grid uses a single `activeGesture: GestureKind | null` to prevent concurrent interactions:

```tsx
// Block pointer down — don't start drag if something else is happening
if (activeGesture || draftState.active || editingId !== null || event.button !== 0) return
// Also skip if target is input/button
if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return

// Start handlers check:
if (activeGesture || !gridBodyElement) return

// Move handlers check pointerId to handle only our gesture's pointer:
if (!dragState || dragState.pointerId !== event.pointerId) return
```

The `pointerId` check is critical — it ensures the move handler only processes events from the pointer that started the gesture, even if other pointers interact.

---

## Window Event Binding

Gestures bind to `window` (not the element) to capture events when the pointer leaves the block/grid:

```tsx
function bindWindowEvents() {
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerEnd)
  window.addEventListener('pointercancel', onWindowPointerCancel)
}
```

The central dispatcher routes by `activeGesture`:

```tsx
function onWindowPointerMove(event: PointerEvent) {
  if (activeGesture === 'drag') moveDrag(event)
  else if (activeGesture === 'resize') moveResize(event)
}
```

**Important**: Unbind on end, cancel, and error. Use `removeEventListener` with the same function reference.

---

## Grid Measurement Helpers

```tsx
function measureGrid(element: HTMLElement): GridMeasurement {
  let rect = element.getBoundingClientRect()
  return {
    dayWidth: Math.max(1, (rect.width - LABEL_WIDTH) / 7),
    labelWidth: LABEL_WIDTH,
    left: rect.left,
    rowHeight: SLOT_HEIGHT,
    top: rect.top,
  }
}

function pointerToPlacement(event, grid, days) {
  let blockLeft = event.clientX - dragState.offsetX
  let blockTop = event.clientY - dragState.offsetY

  let rawDay = (blockLeft - grid.left - grid.labelWidth) / grid.dayWidth
  let dayIdx = clamp(Math.round(rawDay), 0, days.length - 1)
  let date = days[dayIdx]?.date
  if (!date) return null

  let rawMinute = ((blockTop - grid.top) / grid.rowHeight) * 60
  let snappedMinute = Math.round(rawMinute / 15) * 15    // 15-min snap
  let startMinute = clamp(snappedMinute, 0, 24 * 60 - 15)  // last slot 23:45

  return { date, startMinute }
}

function pointerToResizeMinute(event, state) {
  let edgeY = event.clientY - state.offsetY                // offset relative to block edge
  let rawMinute = ((edgeY - state.grid.top) / state.grid.rowHeight) * 60
  let snapped = Math.round(rawMinute / 15) * 15            // 15-min snap

  if (state.edge === 'start') {
    return clamp(snapped, 0, state.originalBlock.end_min - 15)
  }
  return clamp(snapped, state.originalBlock.start_min + 15, 24 * 60)
}
```

**Snapping**: Always round to 15 (`Math.round(v / 15) * 15`). The layout solver also snaps via `clampMinute()` with `slotMinutes: 15`, but the UI should pre-snap so the ghost/solver align visually. The last valid snap is `24 * 60 - 15` (23:45), not `24 * 60`.

---

## Visual Feedback

### Dragged block

CSS `transform: translate()` for smooth sub-cell offset while pointer hasn't crossed a cell boundary:

```tsx
style={`transform: translate(${offsetX}px, ${offsetY}px)`}
```

The block also gets `opacity: 0.6`, `zIndex: 4`, `pointerEvents: 'none'`.

### Ghost block

Rendered as a separate absolutely-positioned div with dashed border, positioned at the solver's target location:

```tsx
{isDragging && preview ? (
  preview.blocks
    .filter(b => b.id === dragState?.blockId)
    .map(ghost => (
      <div
        mix={ghostBlockStyle}
        style={`top: ${(ghost.start_min / 60) * SLOT_HEIGHT}px; height: ${...}px`}
      />
    ))
) : null}
```

### Cursor

Global cursor changes via CSS attribute selectors on the grid wrapper:

```tsx
'&[data-dragging="true"], &[data-dragging="true"] *': {
  cursor: 'grabbing !important',
  userSelect: 'none',
}
'&[data-resizing="true"], &[data-resizing="true"] *': {
  cursor: 'ns-resize !important',
}
```

---

## Resize Handles

Thin 12px-tall horizontal bars at top (`start`) and bottom (`end`) of each block:

```tsx
const resizeHandleStyle = css({
  cursor: 'ns-resize',
  height: '12px',
  position: 'absolute',
  left: theme.space.xs,
  right: theme.space.xs,
  opacity: 0,       // hidden by default
  touchAction: 'none',
  zIndex: 3,
  '&::before': {    // visible bar — 28px wide, 3px tall
    backgroundColor: theme.colors.focus.ring,
    borderRadius: '999px',
    content: '""',
    height: '3px',
    width: '28px',
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  '&:hover': { opacity: 1 },  // show on hover
})
```

Only visible on hover or during active resize. The handles prevent the `pointerdown` from bubbling to the block's drag handler (`e.stopPropagation()`).

---

## Important Caveats

- **Offset invariant**: The `offsetX`/`offsetY` in `DragState` are computed once at start. This ensures the block stays under the pointer at the same relative grab point throughout the drag.
- **End-edge offsetY uses `end_min`**: In `startResize`, the `offsetY` for the end edge is computed relative to the block's `end_min` (not `start_min`). This ensures the pointer-to-minute mapping correctly follows the bottom edge:
  ```tsx
  offsetY: event.clientY - (grid.top + ((edge === 'end' ? appt.end_min : appt.start_min) / 60) * grid.rowHeight),
  ```
- **`touchAction: 'none'`**: Required on block elements to prevent scroll interference on touch devices.
- **Scroll during drag**: `GridMeasurement` is frozen at start. If the user scrolls the page, coordinates will drift. Mitigation: Use a scrollable container with `overflowY: auto` and measure relative to that container's `getBoundingClientRect()`.
- **`pointercancel`**: The window handler for `pointercancel` calls `cancelDrag()`/`cancelResize()` — this reverts state without saving. Always bind this.
- **`pointerId` matching**: Always verify `pointerId` in move/end handlers. Without this guard, a second pointer could prematurely end the gesture.
- **Snapshot at start**: `originalBlocks` must be a deep copy of the appointment array. Mutations to the source array during drag would corrupt the solver's base state.
- **Snap granularity**: All pointer-to-minute conversions use 15-min snap (`Math.round(v / 15) * 15`). The minimum resize delta is 15 minutes — the resize clamp ensures no block can shrink below 15 min.
- **Save ALL changes**: On end, iterate `LayoutResult.changes` and PUT every `moved`/`resized` block. The solver may have shifted other blocks in the collision chain — they also need persisting.

---

## 📂 Codebase References

| File | Role |
|------|------|
| `newapp/app/ui/appointment-grid.tsx` | Full gesture implementation (lines 424–774) |
| `newapp/app/ui/schedule-layout.ts` | Layout solver called by gesture handlers |

## Related

- [Layout Solver](./layout-solver.md) — Pure-function collision resolution called by gesture handlers
- [Weekly Grid Pattern](./appointment-grid.md) — Host component for the gesture system
- [Events](./events.md) — Signal-based event handling pattern in Remix 3
- [Interaction Mixins](../ui/guides/interaction-mixins.md) — `createMixin()` alternative for reusable gestures
