<!-- Context: project-intelligence/newapp/guides/appointtype-drag-insert | Priority: high | Version: 1.1 | Updated: 2026-05-25 -->

# Guide: AppointType Drag-to-Insert Pattern

**Purpose**: Drag an appointment type from the types panel and drop it onto the calendar grid to create an appointment with that type's title, duration, and user_id — no manual typing.

---

## Overview

```
┌─────────────────┐     pointerdown       ┌──────────────────────┐
│  AppointType     │ ──────────────────►  │  appointtype-drag.ts  │
│  Panel           │   setTypeDragState() │  (module-level       │
│  (pointerdown)   │                      │   singleton state)   │
└─────────────────┘                      └──────────┬───────────┘
                                                    │
                    pointermove/pointerup            │ getTypeDragState()
                    (document-level listeners)       │
                                                    ▼
┌──────────────────────────────────────────────────────────────┐
│  Appointment Grid                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ onTypeDragMove() — measures grid position, snaps to   │  │
│  │   15-min boundary, shows blue ghost block             │  │
│  │ onTypeDragEnd() — POST /appointment with typeId       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## The Drag State Singleton

A shared module-level singleton carries the type info from the panel to the grid. No React state, no events — just a getter/setter pair:

```ts
// app/lib/appointtype-drag.ts
export interface TypeDragState {
  active: boolean
  typeId: number
  title: string
}

let _typeDragState: TypeDragState | null = null

export function getTypeDragState(): TypeDragState | null {
  return _typeDragState
}

export function setTypeDragState(state: TypeDragState | null): void {
  _typeDragState = state
}
```

**Why a module singleton?** Both `appointtype-panel.tsx` and `appointment-grid.tsx` are `clientEntry` components that compile into independent closures. They cannot share JavaScript state through the server-side render tree. The module becomes the rendezvous point — both files import from the same module, so both closures close over the same `_typeDragState` variable.

---

## Panel Side: Initiating the Drag

The types panel sets drag state on `pointerdown` and clears on `pointerup` (in case the drop misses the grid):

```tsx
// In appointtype-panel.tsx, on each type row:
<div
  on('pointerdown', (e) => handlePointerDown(t, e))
  on('pointerup', () => handlePointerUp())
/>

function handlePointerDown(type: AppointType, event: PointerEvent) {
  if (editingId !== null || adding) return  // don't start while editing
  if (event.button !== 0) return            // left button only

  setTypeDragState({ active: true, typeId: type.id, title: type.title })
}

function handlePointerUp() {
  // Grid's pointerup handler commits the drop. If the pointerup
  // fires outside the grid (quick click), the grid handler won't
  // run — so clear here.
  if (getTypeDragState()) {
    setTypeDragState(null)
  }
}
```

**Cursor feedback** — The type items use `cursor: 'grab'` in their CSS to hint at draggability. No visual feedback beyond that (the grid shows the ghost).

---

## Grid Side: Consuming the Drop

The grid registers **document-level** event listeners once on initialization (not per render):

```tsx
// In appointment-grid.tsx, constructor scope:
if (typeof document !== 'undefined') {
  document.addEventListener('pointermove', onTypeDragMove, { signal: handle.signal })
  document.addEventListener('pointerup', onTypeDragEnd, { signal: handle.signal })
  document.addEventListener('pointercancel', onTypeDragCancel, { signal: handle.signal })
}
```

**Why document-level?** The `pointerdown` that initiated the drag was on a type item in the panel, not on the grid itself. A grid-level listener would miss events that start outside the grid. Document-level capture ensures we can track the pointer regardless of where it moves.

### onTypeDragMove — Ghost Block Preview

```tsx
function onTypeDragMove(event: PointerEvent) {
  let state = getTypeDragState()
  // Block if other gestures are active (existing drag/resize, draft, edit)
  if (activeGesture || draftState.active || editingId !== null) return
  if (!state?.active || !gridBodyElement) return

  let data = readData()
  let grid = measureGrid(gridBodyElement)

  // Compute day from pointer x
  let rawDay = (event.clientX - grid.left - grid.labelWidth) / grid.dayWidth
  let dayIdx = clamp(Math.round(rawDay), 0, data.days.length - 1)
  let date = data.days[dayIdx]?.date

  // Snap to 15-min boundary (0, 15, 30, ... 1425)
  let rawMinute = ((event.clientY - grid.top) / grid.rowHeight) * 60
  let startMinute = clamp(Math.round(rawMinute / 15) * 15, 0, 24 * 60 - 15)

  // Only update on change (avoid redundant re-renders)
  if (
    typeDragPreview &&
    typeDragPreview.date === date &&
    typeDragPreview.startMinute === startMinute
  ) return

  typeDragPreview = { date, startMinute, dayIdx }
  handle.update()
}
```

The ghost block uses a distinct CSS class:

```tsx
const typeDragGhostStyle = css({
  backgroundColor: 'rgb(147 197 253 / 0.5)',    // blue tint (vs gray for move ghost)
  border: `2px dashed ${theme.colors.action.primary.background}`,
  // ...same positioning as other ghost blocks
})
```

**Visual distinction** — The type-drag ghost is blue, while the move ghost (`ghostBlockStyle`) is gray. This communicates "creating new" vs "moving existing".

### onTypeDragEnd — Commit the Creation

```tsx
function onTypeDragEnd(_event: PointerEvent) {
  let state = getTypeDragState()
  if (!state?.active) return

  let preview = typeDragPreview
  clearTypeDragPreview()

  if (preview) {
    let csrfToken = readData().csrfToken
    fetch('/appointment', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Csrf-Token': csrfToken,
      },
      body: JSON.stringify({
        typeId: state.typeId,       // ← triggers INSERT...SELECT path
        date: preview.date,
        start_min: preview.startMinute,
      }),
    })
      .then((r) => {
        if (r.ok) window.location.reload()
        else alert('Fehler beim Erstellen des Termins.')
      })
      .catch(() => alert('Fehler beim Erstellen des Termins.'))
  }

  setTypeDragState(null)
}
```

**Key flow:**
1. **Snapshot the drag state** — Read before clearing
2. **Clear preview** — Ghost disappears immediately via `clearTypeDragPreview()`
3. **Fetch with `typeId`** — Server sees `typeId` and uses INSERT...SELECT (see [INSERT...SELECT guide](./appointtype-insert-select.md))
4. **Full page reload** — Simpler than Frame reload; all grid state is server-rendered from URL params
5. **Error feedback** — Plain `alert()` for failures
6. **Clear drag state** — Always runs, even on error

---

## Interaction Guarding

The type-drag path is blocked whenever another interaction is active:

```tsx
// In onTypeDragMove:
if (activeGesture || draftState.active || editingId !== null) return
```

This prevents:
- **Existing block drag/resize** (`activeGesture`) — can't have two simultaneous pointer captures
- **Draft state** (`draftState.active`) — inline "new appointment" text input is open
- **Editing state** (`editingId !== null`) — an appointment title rename is in progress

For the panel side, `handlePointerDown` also guards against its own editing states (`editingId !== null || adding`).

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/lib/appointtype-drag.ts` | 1–15 | Shared `TypeDragState` singleton (getter/setter) |
| `app/ui/appointtype-panel.tsx` | 36–38, 295–309 | Panel: drag state init on `pointerdown` + cleanup on `pointerup` |
| `app/ui/appointment-grid.tsx` | 157–169, 1053–1116 | Grid: document-level type-drag listeners + handlers |
| `app/ui/appointment-grid.tsx` | 421–430 | Type-drag ghost block (blue dashed) render in day columns |
| `app/ui/appointment-grid.tsx` | 1444–1455 | CSS `typeDragGhostStyle` — blue tint vs gray move ghost |

## Related

- [AppointType INSERT...SELECT Pattern](./appointtype-insert-select.md) — Server-side typeId → appointment creation
- [Drag-to-Trashcan Delete](./drag-to-trashcan.md) — Similar gesture pattern for deletion (document-level listeners, ghost block preview)
- [AppointType Inline CRUD (Frame)](./appointtype-inline-crud.md) — Managing the types that feed into this drag mechanism
- [Weekly Grid Gesture Architecture](../concepts/appointment-calendar.md) — Full grid gesture state machine
- [Drag & Resize Gestures](../../development/remix3/guides/drag-resize-gestures.md) — Existing drag/resize patterns that type-drag integrates alongside
