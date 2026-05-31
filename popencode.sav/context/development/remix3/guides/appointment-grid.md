<!-- Context: development/remix3/guides/appointment-grid | Priority: medium | Version: 1.2 | Updated: 2026-05-25 -->

# Guide: Weekly Calendar Grid Pattern

**Purpose**: Build a scrollable weekly calendar grid using CSS Grid with sticky headers, event slot rendering, and client-side interaction via `on()` mixin and `clientEntry` hydration.

---

## Overview

A weekly calendar grid displays 7 day columns (Mon–Sun) × 24 hour rows. The pattern uses:

- **CSS Grid** for the header row + scrollable body layout
- **`position: sticky`** for column headers and sidebar
- **`on()` mixin** for click, double-click, and keyboard events
- **`clientEntry`** for client-side state (draft creation, inline rename, delete)
- **Server-embedded JSON** for passing appointments data to the client

---

## 1. Grid Layout

### Outer Wrapper

```tsx
import { css } from 'remix/ui'

const gridWrapperStyle = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',  // header + scrollable body
})
```

### Header Row (sticky)

The header has `width × (7 + 1 label)` columns and stays at the top:

```tsx
const LABEL_WIDTH = 56  // px for time labels

const headerRowStyle = css({
  display: 'grid',
  gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, 1fr)`,
  position: 'sticky',
  top: 0,
  zIndex: 2,
  backgroundColor: theme.surface.lvl0,
  borderBottom: `1px solid ${theme.colors.border.strong}`,
})
```

### Body Grid

```tsx
const gridBodyStyle = css({
  display: 'grid',
  gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, 1fr)`,
})
```

Each day column has `position: relative` and `minHeight: ${24 * SLOT_HEIGHT}px` to establish the 24-hour canvas:

```tsx
const HOURS = 24
const SLOT_HEIGHT = 160        // px per hour (4x scale: 15min = 40px visual density)
const SUB_SLOTS = 4            // quarter-hour subdivisions per hour
const SUB_SLOT_HEIGHT = SLOT_HEIGHT / SUB_SLOTS  // 40px per 15-min slot

const dayColumnStyle = css({
  borderLeft: `1px solid ${theme.colors.border.subtle}`,
  minHeight: `${HOURS * SLOT_HEIGHT}px`,
  position: 'relative',
})
```

**Scale rationale**: `SLOT_HEIGHT = 160` (4× the original `40`) keeps the visual density identical per 15-min block. Each 15-min slot renders at `40px` — the same height as one hour used to be. This enables 15-min snap precision without making blocks too small to see or interact with.

### Time Labels

Time labels are positioned absolutely inside their row slot:

```tsx
const timeSlotRowStyle = css({
  height: `${SUB_SLOT_HEIGHT}px`,
  position: 'relative',
})

const timeLabelStyle = css({
  position: 'absolute',
  right: 0,
  top: '-6px',
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const subTimeLabelStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxs,
  paddingRight: theme.space.xs,
  position: 'absolute',
  right: 0,
  top: '-3px',
  opacity: 0.4,                // faded appearance for :30 labels
})
```

Hour labels use `:00` format (e.g., `9:00`). Half-hour marks show faded `:30` labels. Quarter-hour marks (:15, :45) show no labels — only row lines.

Hour `0` renders an empty label (no "0:00" shown). Hours 1–23 show `"${hour}:00"` at their hour marks.

---

## 2. Rendering Hours and Quarter-Hour Slots

The grid renders **96 quarter-hour rows** per column (24 hours × 4 subdivisions) using `Array.from({ length: HOURS * SUB_SLOTS })`:

```tsx
<div key={`day${dayIdx}`} mix={dayColumnStyle}>
  {Array.from({ length: HOURS * SUB_SLOTS }, (_, slot) => {
    let minute = slot * 15
    let isHour = slot % SUB_SLOTS === 0
    return (
      <div
        key={`m${minute}`}
        mix={[
          isHour ? hourLineStyle : subHourLineStyle,
          on('click', () => startDraft(dayIdx, minute)),
        ]}
      />
    )
  })}
  {/* Appointment blocks positioned absolutely here */}
</div>
```

**Visual grid lines:**
- **Hour marks** (slot % 4 === 0): solid `1px` border-top lines
- **Quarter-hour marks** (slot % 4 !== 0): dashed `1px` border-top lines (faded appearance)

```tsx
const hourLineStyle = css({
  borderTop: `1px solid ${theme.colors.border.default}`,  // solid
  height: `${SUB_SLOT_HEIGHT}px`,
  cursor: 'pointer',
  '&:hover': { backgroundColor: theme.surface.lvl2 },
})

const subHourLineStyle = css({
  borderTop: `1px dashed ${theme.colors.border.subtle}`,  // dashed
  height: `${SUB_SLOT_HEIGHT}px`,
  cursor: 'pointer',
  '&:hover': { backgroundColor: theme.surface.lvl2 },
})
```

The time column also renders 96 rows, with labels only at hours (`:00`) and half-hours (`:30`):

```tsx
{Array.from({ length: HOURS * SUB_SLOTS }, (_, slot) => {
  let minute = slot * 15
  let isHour = slot % SUB_SLOTS === 0
  let isHalf = slot % SUB_SLOTS === 2
  return (
    <div key={`t${slot}`} mix={timeSlotRowStyle}>
      {isHour && minute > 0 ? (
        <span mix={timeLabelStyle}>{minute / 60}:00</span>
      ) : isHalf ? (
        <span mix={subTimeLabelStyle}>:30</span>
      ) : null}
    </div>
  )
})}
```

---

## 3. Appointment Block Positioning

Appointment blocks are **absolutely positioned** inside each day column. Top and height are calculated from minutes:

```tsx
let topPx = (appt.start_min / 60) * SLOT_HEIGHT
let heightPx = Math.max(
  isEditing ? 84 :               // editing minimum: textarea + buttons
  ((appt.end_min - appt.start_min) / 60) * SLOT_HEIGHT,  // purely proportional
)

return (
  <div
    mix={blockBoxStyle}
    style={`top: ${topPx}px; height: ${heightPx}px;`}
  >
    {appt.title}
  </div>
)
```

**Key points:**
- `start_min` / `end_min` are minutes from midnight (0–1440)
- Divide by 60 to get hours, multiply by `SLOT_HEIGHT` (160) for pixels
- **Non-editing minimum removed**: Block heights are purely proportional to duration. A 15-min block renders at `(15/60)*160 = 40px`. No artificial minimum.
- **Editing minimum (84px)**: When the textarea and Save/Cancel buttons are visible, the block must be tall enough to contain them — enforced only during editing
- Each day column must have `position: relative` as the positioning anchor

---

## 4. Event Handling with `on()` Mixin

Events are attached inline using the `on(eventName, handler)` function inside the `mix` array:

```tsx
import { on } from 'remix/ui'

// Click on hour slot → start draft creation
<div mix={[hourLineStyle, on('click', () => startDraft(dayIdx, hour * 60))]} />

// Double-click on appointment → start rename
<div mix={[blockBoxStyle, on('dblclick', () => startEdit(appt))]}>
```

**Event types commonly used in calendar grids:**

| Event | Target | Action |
|-------|--------|--------|
| `click` | Empty hour slot | Start draft creation |
| `dblclick` | Appointment block | Start inline rename |
| `keydown` | Input field | Commit on Enter, cancel on Escape |
| `blur` | Textarea | Cancel edit/draft (discard without save) |

**Important**: The `on()` mixin returns a mixin object. It must be used **inside the `mix` array** alongside CSS style mixins, not as a standalone attribute.

---

## 5. clientEntry Hydration

The entire grid is a single `clientEntry` component:

```tsx
import { clientEntry, css, on, ref, type Handle } from 'remix/ui'

export const MyCalendarGrid = clientEntry(
  import.meta.url + '#MyCalendarGrid',
  function MyCalendarGrid(handle: Handle) {
    // Closure-scoped state
    let draftState = { active: false, dayIdx: 0, start: 0, end: 60 }

    return () => {
      // Read fresh data from embedded JSON on each render
      return <div>...</div>
    }
  },
)
```

**State management pattern:**
- All mutable state is closure-scoped in the setup function
- After state changes, call `handle.update()` to re-render
- The render function reads fresh data from the embedded `<script>` tag

### Using `ref()` for DOM references

```tsx
<input
  mix={[
    inputStyle,
    ref((el) => { draftInput = el }),
    on('keydown', (e) => { if (e.key === 'Enter') commitDraft(e) }),
  ]}
/>
```

The `ref()` mixin captures the DOM element on mount. Use a `Map<id, HTMLTextAreaElement>` for dynamic lists of elements (rename inputs).

---

## 6. Server-Embedded JSON Data

Appointment data is passed from server to client via a `<script type="application/json">` tag:

```tsx
// Server component renders:
<script id="appointment-data" type="application/json">
  {JSON.stringify({ year, week, days, appointments, csrfToken })}
</script>

// Client reads:
function readData() {
  try {
    let el = document.getElementById('appointment-data')
    if (!el) return {}
    return JSON.parse(el.textContent || '{}')
  } catch {
    return {}
  }
}
```

The `readData()` function is called **during render** (not setup), so the data includes any updates after page reloads.

---

## 7. Interaction Patterns

### Click to Create (Draft)

1. Click empty quarter-hour slot → show dashed draft block with `<textarea rows={2}>`
2. Draft defaults to 15-min duration: `end = start + 15` (snapped to 15-min boundary)
3. Type title → **Shift+Enter** or click **Save** button → `fetch('POST /appointment', json)`
4. **Enter** inserts newline; **Escape** or **Cancel** button or **blur** discards without POST
5. On success → `window.location.reload()`

### Double-click to Rename

1. Double-click appointment block → show `<textarea rows={2}>` pre-filled with title
2. Edit title → **Shift+Enter** or **Save** button → `fetch('PUT /appointment/:id', json)`
3. **blur** cancels (discards changes — was previously auto-save); **Escape** or **Cancel** button also cancels
4. Save/Cancel buttons use `pointerdown` to avoid the blur-before-click race
5. On success → `window.location.reload()`

### Delete via Drag-to-Trashcan

1. Start dragging an appointment block → trashcan icon appears in the grid header's upper-left corner
2. Drag the block over the trashcan → trashcan highlights red to indicate deletion
3. Release on the highlighted trashcan → `fetch('DELETE /appointment/:id')`
4. On success → `window.location.reload()`

The trashcan is only visible during drag (not resize) and does not interfere with `dblclick` inline rename. See the [Drag-to-Trashcan Guide](../../project-intelligence/newapp/guides/drag-to-trashcan.md) for full implementation details.

---

## 8. Draft State Guarding

Prevent concurrent interactions:

```tsx
let draftState = { active: false, dayIdx: 0, start: 0, end: 60 }

function startDraft(dayIdx, startMin) {
  if (draftState.active) return  // guard: no concurrent drafts
  draftState.active = true
  draftState.start = startMin
  draftState.end = startMin + 15  // 15-min default duration
  // ...
  handle.update()
  requestAnimationFrame(() => draftInput?.focus())  // rAF more reliable than setTimeout
}

function startEdit(appt) {
  if (editingId !== null) return  // guard: only one rename at a time
  editingId = appt.id
  // ...
}
```

---

## 9. Drag-and-Drop & Resize (Phase 2)

Phase 2 added drag-and-drop to move blocks between days/times and resize handles on block edges to change duration. These features use:

- **Closure-based gesture state machine** ([Drag & Resize Gestures Guide](./drag-resize-gestures.md)) — `DragState`/`ResizeState` with window-level pointer events, start/move/end/cancel lifecycle, grid measurement helpers, pointer-to-placement helpers
- **Pure-function layout solver** ([Layout Solver Guide](./layout-solver.md)) — `schedule-layout.ts` resolves collisions when a moved/resized block would overlap others, using a cost-based algorithm (minimize moved blocks → total distance → natural index)
- **15-minute snap granularity** — All pointer-to-minute conversions use `Math.round(rawMinute / 15) * 15`. The last valid snap position is `24 * 60 - 15 = 1425` (23:45). Resize minimum delta is also 15 minutes.
- **`SLOT_HEIGHT = 160`** (4× scale) — The drag/resize helpers compute position using `(minute / 60) * 160`. The `GridMeasurement.rowHeight` also reflects 160px per hour.
- **Single `activeGesture` guard** — Prevents concurrent drag/resize/draft/edit — `if (activeGesture || draftState.active || editingId) return`

### New State Variables

```tsx
let preview: LayoutResult | null = null          // solver output for ghost rendering
let dragState: DragState | null = null            // active drag state
let resizeState: ResizeState | null = null        // active resize state
let activeGesture: GestureKind | null = null      // 'drag' | 'resize' guard
let gridBodyElement: HTMLElement | null = null    // ref to scrollable grid body
let draggedBlockOffset = { x: 0, y: 0 }           // sub-cell translate
```

### Preview Blocks During Gestures

During drag/resize, the grid renders the **solver output** (not the original data):

```tsx
let sourceBlocks = preview?.blocks ?? data.appointments
```

This ensures the ghost block and shifted neighbors are visible in real time.

### Mutation: Batch PUT on Drop/Release

Unlike Phase 1 single-PUT mutations, drag/resize may shift multiple blocks. The end handler collects all `moved`/`resized` changes from the solver and issues parallel PUTs:

```tsx
let saves = finalPreview.changes
  .filter(c => (c.kind === 'moved' || c.kind === 'resized') && c.after)
  .map(c => saveBlockPosition(c.id, c.after, csrfToken))
let results = await Promise.allSettled(saves)
if (results.some(r => r.status === 'fulfilled' && r.value.ok)) {
  window.location.reload()
}
```

---

## 📂 Codebase References

- **Calendar grid (newapp)**: `newapp/app/ui/appointment-grid.tsx` — Weekly grid with draft create, inline rename, delete, drag-and-drop, resize (1518 lines)
- **Layout solver (newapp)**: `newapp/app/ui/schedule-layout.ts` — Pure function collision resolution (481 lines)
- **Page shell (newapp)**: `newapp/app/ui/appointment-page.tsx` — Layout with sidebar+grid gridTemplateColumns
- **Sidebar (newapp)**: `newapp/app/ui/appointment-sidebar.tsx` — Year/week dropdown pickers with sticky positioning

## Related

- [Drag & Resize Gestures](./drag-resize-gestures.md) — Closure-based gesture state machine for drag-and-drop and resize
- [Layout Solver](./layout-solver.md) — Pure-function collision resolution
- [Server-Embedded JSON](./server-embedded-json.md) — `<script type="application/json">` data passing
- [Inline Editing Patterns](./inline-editing-patterns.md) — Double-click to edit table cells
- [clientEntry Hash Fragment Pattern](../../project-intelligence/newapp/guides/client-entry-pattern.md) — `import.meta.url + '#ExportName'`
- [Client Interactivity (remix3)](../ui/guides/client-interactivity-patterns.md) — `on()`, `ref()`, `handle.update()` lifecycle
