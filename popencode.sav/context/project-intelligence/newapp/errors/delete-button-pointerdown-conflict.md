<!-- Context: project-intelligence/newapp/errors/delete-button-pointerdown-conflict | Priority: high | Version: 1.0 | Updated: 2026-05-22 -->

# Error: × Delete Button Conflict with Double-Click Editing

**Symptom**: After adding a visible × delete button to appointment blocks, double-clicking the block to rename stops working — `dblclick` never fires.

---

## Root Cause

The conflict has three layers:

### 1. Drag Gesture Requires `pointerdown` + `preventDefault()`

The appointment block needs `pointerdown` with `preventDefault()` to initiate drag:

```tsx
// appointment-grid.tsx — block mixin:
<div
  mix={[
    blockBoxStyle,
    on('dblclick', () => startEdit(appt)),               // inline rename
    on('pointerdown', (e) => handleBlockPointerDown(appt, e)),  // drag start
  ]}
>
```

Inside `handleBlockPointerDown`:
```tsx
function handleBlockPointerDown(appt, event) {
  // ...guard checks...
  event.preventDefault()  // ← required for drag gesture
  startDrag(appt, event)
}
```

**Why `preventDefault()` is needed**: On touch devices, the browser synthesizes a `click` event 300ms after `pointerup`. Calling `preventDefault()` on `pointerdown` suppresses this delay. Without it, the drag gesture would feel laggy on touch. See the `touchAction: 'none'` on `blockBoxStyle` — this is the same category of scroll-prevention.

### 2. `preventDefault()` on `pointerdown` Prevents `dblclick`

The DOM specification states that `dblclick` is not dispatched on an element if the `pointerdown` event was cancelled via `preventDefault()`. The relevant spec text: "If the event dispatch is canceled, the user agent must not dispatch `dblclick` event."

This means **any element that has a `pointerdown` handler with `preventDefault()` will never receive `dblclick` events** — including child elements.

### 3. The × Button Was Inside the Block

The × button was a child of the block element:

```tsx
<div mix={blockBoxStyle}>           // ← pointerdown + preventDefault here
  <span>{appt.title}</span>
  <button                         // ← child element
    on('click', () => deleteAppointment(appt, csrfToken))
  >×</button>
</div>
```

When the user clicks the × button:
- `pointerdown` fires on the block (parent) → `preventDefault()` called
- `click` fires on the button — delete handler runs ✅
- But `dblclick` is **suppressed** on the block due to the cancelled `pointerdown`

**Result**: The × button works for delete, but the block's `dblclick` rename **never fires**. This broke the double-click editing flow.

---

## Resolution

**Remove the × button entirely.** Move the delete action outside the appointment block to an element that doesn't need `pointerdown` + `preventDefault()`.

The drag-to-trashcan approach achieves this:
- The trashcan lives in the header row corner cell — outside any appointment block
- It uses its own `ref()` mixin for hit-testing, independent of block events
- No `pointerdown` handlers are needed on the trashcan itself
- `dblclick` on blocks continues to work normally

See the [Drag-to-Trashcan Guide](../guides/drag-to-trashcan.md) for the full implementation.

---

## Could We Fix It Differently?

| Approach | Verdict | Why |
|----------|---------|-----|
| Remove `preventDefault()` on drag start | ❌ | Breaks touch responsiveness — 300ms click delay |
| Use `click` only (no `pointerdown`) for drag | ❌ | `click` fires after `mouseup`, too late for gesture start |
| Move button outside block, keep × in header | ❌ | Buttons in header would be far from their target block |
| Drag-to-trashcan (current solution) | ✅ | No interaction conflict, clean UX |

## Related Workaround: Manual Double-Click Detection

Even with the drag-to-trashcan fix, double-click editing is still broken for all blocks because `event.preventDefault()` on `pointerdown` suppresses native `dblclick`. A separate fix was applied in `handleBlockPointerDown`:

```tsx
let lastClick = { time: 0, blockId: -1 }

function handleBlockPointerDown(appt, event) {
  // ...guards...
  let now = Date.now()
  if (now - lastClick.time < 350 && lastClick.blockId === appt.id) {
    lastClick.time = 0
    startEdit(appt)
    return    // ← early return: no preventDefault, no drag
  }
  lastClick.time = now
  lastClick.blockId = appt.id
  event.preventDefault()
  startDrag(appt, event)
}
```

This detects rapid sequential `pointerdown` events on the same block and routes them to `startEdit()` directly, bypassing the drag system entirely. The drag from the first click is safely cleaned up by `endDrag()` on the intervening `pointerup`.

**Note**: The table above marks "Add dblclick via pointerdown counting" as ❌ because it was not a viable fix for the × button conflict (the button was inside the block). As a general workaround for the `dblclick` suppression itself, the `lastClick` approach is the **actual deployed solution**.

See the dedicated concept file for full analysis: [Manual Double-Click Detection](../concepts/manual-doubleclick-detection.md).

---

## Prevention

When building with `clientEntry` and the `on()` mixin:

- **If you add `pointerdown` + `preventDefault()` to an element, `dblclick` will not fire on that element or its children.**
- Use an alternate interaction for elements inside the blocked region — or move them outside entirely.
- Consider the `touchAction` CSS property as a more targeted alternative to `preventDefault()` on `pointerdown` for touch-only suppression.

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/ui/appointment-grid.tsx` | 466–487 | `handleBlockPointerDown()` — `preventDefault()` + manual double-click detection |
| `app/ui/appointment-grid.tsx` | 205–206 | Block mixin: `dblclick` handler (dead code — never fires) |
| `app/ui/appointment-grid.tsx` | 84 | `lastClick` state variable for manual double-click detection |
| `app/ui/appointment-grid.tsx` | 92–93 | `isOverTrashcan` flag — the replacement approach |

## Related

- [Drag-to-Trashcan Guide](../guides/drag-to-trashcan.md) — Replacement mechanism for the removed × button
- [Manual Double-Click Detection](../concepts/manual-doubleclick-detection.md) — Workaround for pointerdown+preventDefault dblclick suppression
- [Weekly Grid Pattern](../../development/remix3/guides/appointment-grid.md) — Grid interaction patterns
- [Drag & Resize Gestures](../../development/remix3/guides/drag-resize-gestures.md) — Gesture state machine (hosts pointerdown handler)
