<!-- Context: project-intelligence/newapp/guides/drag-to-trashcan | Priority: high | Version: 1.0 | Updated: 2026-05-22 -->

# Guide: Drag-to-Trashcan Delete

**Purpose**: Allow users to delete appointment blocks by dragging them onto a trashcan drop zone that appears in the grid header during drag operations. Replaces the per-block × delete button which conflicted with double-click editing.

---

## Overview

The trashcan appears in the upper-left corner of the grid header when a drag gesture is active. As the user drags a block over the trashcan zone, it highlights red. Dropping on the highlighted zone sends a `DELETE /appointment/:id` request.

This approach avoids two hard problems:
- **No interaction conflict** — The trashcan lives outside the appointment block, so it doesn't interfere with `pointerdown`/`dblclick` on blocks
- **No UI clutter** — The trashcan is hidden until a drag starts, so it doesn't take up space during normal viewing

---

## State Variables

```tsx
// In the clientEntry closure:
let isOverTrashcan = false              // whether pointer is inside trashcan zone
let trashcanElement: HTMLElement | null = null  // ref to trashcan DOM element
```

`isOverTrashcan` is checked in `endDrag()` (line 556) to decide whether to DELETE or save the moved position.

---

## Trashcan UI & Positioning

The trashcan lives in the **corner cell** of the sticky header row — the cell above the time label column and to the left of the day headers:

```tsx
<div mix={headerRowStyle}>
  <div mix={cornerCellStyle}>
    {/* Trashcan — visible during drag */}
    <div
      aria-label="Delete appointment"
      mix={[
        trashcanZoneStyle,           // hidden, centered, transition
        isDragging ? trashcanVisibleStyle : undefined,  // show during drag
        isOverTrashcan ? trashcanHoverStyle : undefined, // red on hover
        ref((el) => { if (el) trashcanElement = el }),
      ]}
    >
      {/* Trash can SVG icon */}
      <svg>...</svg>
    </div>
  </div>
  {days.map((day, i) => (            // day headers)
    <div key={i} mix={dayHeaderStyle}>...</div>
  ))}
</div>
```

**Key positioning details:**
- The corner cell is part of the sticky header row (`position: sticky; top: 0; zIndex: 2`)
- The trashcan fills the corner cell with `width: 100%; height: 100%` via `trashcanZoneStyle`
- All positioning is relative to the header row — no extra layout containers needed

---

## CSS States

Three CSS classes handle the trashcan appearance cycle:

```tsx
const trashcanZoneStyle = css({
  alignItems: 'center',
  backgroundColor: 'transparent',
  borderRadius: theme.radius.sm,
  color: theme.colors.text.muted,       // default: dimmed icon
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  opacity: 0,                            // hidden by default
  pointerEvents: 'none',                 // not interactive when hidden
  transition: 'opacity 0.2s, background-color 0.2s, color 0.2s',
  width: '100%',
})

const trashcanVisibleStyle = css({
  opacity: 1,                            // visible during drag
  pointerEvents: 'auto',                 // interactive when visible
})

const trashcanHoverStyle = css({
  backgroundColor: theme.colors.action.danger.background,  // red bg
  color: theme.colors.action.danger.foreground,            // white icon
})
```

**Transition**: The `0.2s` opacity transition smooths the appearance/disappearance. The red highlight swap has no delay — it needs to feel immediate for the user to connect "red = danger = delete".

---

## Hit-Testing in `moveDrag()`

Each `pointermove` event during a drag checks whether the pointer is inside the trashcan zone:

```tsx
function moveDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return

  // ...DRAG_THRESHOLD check...

  // Hit-test against trashcan zone
  if (trashcanElement) {
    let rect = trashcanElement.getBoundingClientRect()
    let overTrashcan =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom

    // Only trigger update when crossing the boundary
    if (overTrashcan !== isOverTrashcan) {
      isOverTrashcan = overTrashcan
      if (preview) preview = null  // clear ghost when over trashcan
      handle.update()
    }
  }

  // When over trashcan, skip placement preview — just return
  if (isOverTrashcan) {
    return
  }

  // ...normal placement logic (pointerToPlacement, solver)...
}
```

**Important behaviors:**
- **Boundary detection only** — `if (overTrashcan !== isOverTrashcan)` only triggers on crossing, not every move event
- **Preview cleared** — When entering the trashcan zone, the ghost block disappears (`preview = null`) so the grid shows only the dragged block heading for the trashcan
- **Early return** — When inside the trashcan zone, the solver is never called, saving CPU cycles
- **`getBoundingClientRect()` each frame** — The rect is re-read every move event. This is correct because the trashcan is in a sticky header that doesn't scroll, but the rect is trivial to compute and keeps the code simple

---

## Delete Dispatch in `endDrag()`

When the drag ends, `endDrag()` checks `wasOverTrashcan` (captured before state reset):

```tsx
async function endDrag(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return

  unbindWindowEvents()

  let blockId = dragState.blockId
  let wasMoved = dragState.moved
  let wasOverTrashcan = isOverTrashcan         // snapshot before reset

  // Reset state first (so UI doesn't flash stale preview)
  draggedBlockOffset = { x: 0, y: 0 }
  dragState = null
  activeGesture = null
  isOverTrashcan = false

  // Drop on trashcan → delete appointment
  if (wasOverTrashcan && blockId) {
    let csrfToken = readData().csrfToken
    preview = null
    handle.update()
    fetch(`/appointment/${blockId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Csrf-Token': csrfToken,
      },
    })
      .then((r) => { if (r.ok) window.location.reload() })
      .catch(() => {})
    return                                // ✋ don't fall through to save logic
  }

  // ...normal save logic (batch PUTs for moved blocks)...
}
```

**Key flow:**
1. **Snapshot `isOverTrashcan`** — Read before resetting state so the flag is preserved
2. **Reset state first** — `dragState = null` and `isOverTrashcan = false` to prevent stale UI
3. **`preview = null` before `handle.update()`** — So the re-render doesn't show ghost blocks
4. **Early return** — Once the delete fetch fires, we skip all save logic (no batch PUTs for the same block)
5. **Fire-and-forget** — The fetch uses `.then()` not `await` in this path (unlike batch saves which need `Promise.allSettled`)
6. **Reload on success** — Same as other mutation paths

---

## State Cleanup in `cancelDrag()`

The cancel handler also resets `isOverTrashcan`:

```tsx
function cancelDrag() {
  unbindWindowEvents()
  draggedBlockOffset = { x: 0, y: 0 }
  preview = null
  dragState = null
  activeGesture = null
  isOverTrashcan = false    // ← cleanup
  handle.update()
}
```

This is critical for the `pointercancel` case — if the system interrupts a drag while the pointer is over the trashcan, the flag must be reset or the next drag will start with a stale `true` value.

---

## Interaction with Resize

The trashcan is **only visible during drag**, not resize:

```tsx
// In the render function:
let isDragging = dragState?.active === true   // true only for drag
let isResizing = resizeState?.active === true  // true only for resize

<div mix={[
  trashcanZoneStyle,
  isDragging ? trashcanVisibleStyle : undefined,   // ← NOT isResizing
  isOverTrashcan ? trashcanHoverStyle : undefined,
]}>
```

The resize gesture does not interact with the trashcan in any way — no hit-testing, no visibility toggle, no flag changes.

---

## How the × Button Failed (Summary)

The previous approach placed a red × button in the upper-right corner of each appointment block. The button handler used `on('click', ...)`. However:

1. The block's `pointerdown` handler calls `event.preventDefault()` (needed for drag gesture capture)
2. `event.preventDefault()` on `pointerdown` **prevents `dblclick` from firing** on the same element
3. Therefore any element inside the block with click handlers also loses `dblclick` on the block
4. The × button's `click` fires, but the block's `dblclick` never fires — breaking inline rename

See the dedicated error file for the full technical analysis: [Delete Button Pointerdown Conflict](../errors/delete-button-pointerdown-conflict.md)

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/ui/appointment-grid.tsx` | 92–93 | `isOverTrashcan` / `trashcanElement` state vars |
| `app/ui/appointment-grid.tsx` | 127–152 | Trashcan SVG + mixin rendering in corner cell |
| `app/ui/appointment-grid.tsx` | 478–495 | Hit-test `isOverTrashcan` in `moveDrag()` |
| `app/ui/appointment-grid.tsx` | 538–546 | Reset `isOverTrashcan` in `cancelDrag()` |
| `app/ui/appointment-grid.tsx` | 549–613 | Delete dispatch in `endDrag()` (lines 564–581) |
| `app/ui/appointment-grid.tsx` | 1046–1068 | CSS: `trashcanZoneStyle`, `trashcanVisibleStyle`, `trashcanHoverStyle` |

## Related

- [× Button Pointerdown Conflict](../errors/delete-button-pointerdown-conflict.md) — Why per-block delete buttons can't coexist with drag gestures
- [Weekly Grid Pattern](../../development/remix3/guides/appointment-grid.md) — CSS grid layout + event handling (delete section updated)
- [Drag & Resize Gestures](../../development/remix3/guides/drag-resize-gestures.md) — Gesture state machine that hosts the trashcan hit-testing
- [Appointment CRUD Guide](./appointment-crud.md) — Server-side delete action and data layer
- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Full feature architecture
- [Known Issues](../lookup/known-issues.md) — Delete has no confirmation, page reload on all mutations
