<!-- Context: project-intelligence/newapp/concepts/manual-doubleclick-detection | Priority: high | Version: 1.0 | Updated: 2026-05-22 -->

# Concept: Manual Double-Click Detection

**Core Idea**: Because `event.preventDefault()` on `pointerdown` suppresses the browser's synthesis of `dblclick` events (per the Pointer Events spec), the appointment grid implements manual double-click detection using `lastClick` timing to invoke the edit flow directly.

---

## Problem

The drag gesture in appointment-grid requires `event.preventDefault()` on `pointerdown` to prevent touch scroll delay. But the DOM spec states: *"If the event dispatch is canceled, the user agent must not dispatch `dblclick` event."*

Since the appointment block has both `pointerdown` (drag start) and `dblclick` (inline rename) handlers on the same element, the native `dblclick` **never fires** — it is dead code.

This is a pre-existing bug since the drag system was introduced (commit `c75d9a0`). Before that, the original code (commit `ce0cff2`) had no `pointerdown` handler, so `dblclick` worked naturally.

---

## Solution

Track the last click per block and detect rapid sequential clicks manually:

```tsx
let lastClick = { time: 0, blockId: -1 }

function handleBlockPointerDown(appt, event) {
  // Guards: skip if gesture active, editing, or target is input/button
  if (activeGesture || draftState.active || editingId !== null || event.button !== 0) return
  if (event.target instanceof HTMLInputElement
   || event.target instanceof HTMLTextAreaElement
   || event.target instanceof HTMLButtonElement) return

  // Manual double-click detection (preventDefault kills native dblclick)
  let now = Date.now()
  if (now - lastClick.time < 350 && lastClick.blockId === appt.id) {
    lastClick.time = 0
    startEdit(appt)
    return                      // ← early return: no preventDefault, no drag
  }
  lastClick.time = now
  lastClick.blockId = appt.id

  event.preventDefault()
  startDrag(appt, event)
}
```

---

## How It Works

The event sequence for a double-click is:

1. **First `pointerdown`** — Records `lastClick`, then calls `event.preventDefault()` + `startDrag()` (drag starts)
2. **First `pointerup`** — `endDrag()` fires on window → drag cleaned up immediately (no movement = no-op)
3. **Second `pointerdown`** — `handleBlockPointerDown` fires again: `activeGesture` is null, timing check detects double-click → `startEdit()` called, no drag started

**Why drag doesn't interfere**: The `pointerup` between clicks terminates the drag and resets `activeGesture`. By the second `pointerdown`, the gesture state machine is idle.

---

## Key Details

- **350ms threshold** — Matches typical browser double-click timing (most browsers use 400–500ms for native `dblclick`)
- **Same-block check** — `lastClick.blockId === appt.id` prevents cross-block rapid clicks from triggering edit
- **`lastClick.time = 0` on match** — Prevents triple-click from triggering edit twice
- **`HTMLTextAreaElement` guard** — User clicks inside the rename textarea should not trigger drag or double-click detection
- **Native `dblclick` on line 205 is dead code** — It never fires because `preventDefault()` is always called on `pointerdown` for single clicks

---

## Limitations

- **Timing threshold**: 350ms is hardcoded. If a user clicks slowly (e.g., accessibility tools), the double-click won't be detected and a drag will start instead.
- **Gesture state dependency**: Relies on `endDrag()` being called between clicks. If the drag system changes its cleanup behavior, the detection could break.
- **Single-block only**: The detection is per-block, not per-grid. Two rapid clicks on different blocks will not trigger edit.

---

## 📂 Codebase References

**Implementation**:
- `app/ui/appointment-grid.tsx` line 84 — `lastClick` state variable
- `app/ui/appointment-grid.tsx` lines 466–487 — `handleBlockPointerDown()` with manual double-click detection
- `app/ui/appointment-grid.tsx` lines 205–206 — Dead `dblclick` handler (never fires)

**Related**:
- [× Button Pointerdown Conflict](../errors/delete-button-pointerdown-conflict.md) — Root cause analysis of the pointerdown+preventDefault → dblclick suppression problem
- [Inline Rename Pattern](../guides/inline-rename-pattern.md) — The edit flow triggered by the detection
- [Drag-to-Trashcan Guide](../guides/drag-to-trashcan.md) — Separate workaround for the same root cause (× button conflict)
