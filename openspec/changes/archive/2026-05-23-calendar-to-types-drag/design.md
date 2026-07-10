## Context

The appointment grid currently has a drag gesture that supports moving blocks (between days/times), resizing (drag handles), and deleting (drag to trashcan). A recent addition added type-drag from the types panel to create appointments. This change adds the reverse: dragging an appointment block onto the types panel creates a new type from its title.

The grid's `endDrag` function already has conditional branches: if over trashcan → DELETE, if position changed → PUT. A new branch is needed: if over types panel → POST to create type.

## Goals / Non-Goals

**Goals:**

- Dragging an appointment block onto the types panel creates a new type with that title
- The appointment stays unchanged (copy semantics, not move)
- Types panel shows a visual drop zone highlight when an appointment is dragged over it
- Works with the existing drag gesture (pointer already captured by grid)

**Non-Goals:**

- Dragging from the types panel into the grid (already implemented)
- Reordering types in the panel
- Batch creation of multiple types at once

## Decisions

### 1. Detect drop zone via shared state + element hit-testing

**Decision**: The grid's existing `endDrag` checks `isOverTrashcan` (computed from pointer position during drag). Similarly, a new `isOverTypesPanel` flag is computed in `moveDrag` by checking if the pointer is within the types panel's bounding rect. The types panel DOM element is found by data attribute (e.g., `data-types-panel="true"`).

**Rationale**: The trashcan pattern already works this way — checking bounding rect during `pointermove`. No new event dispatch or custom events needed. The types panel already has a known location in the DOM (below the sidebar).

### 2. Visual feedback via CSS class on types panel

**Decision**: When the pointer is over the types panel during a grid drag, the panel gets a CSS class (e.g., `drop-active`) that highlights its border. The grid sets a shared state flag, and the types panel reads it to apply the class.

**Rationale**: The grid can't directly update the types panel's render since they're separate client entries. Shared state via the existing `appointtype-drag.ts` module is the established pattern — add a `panelDropActive` flag there. The types panel checks this flag in its render function.

### 3. Copy semantics

**Decision**: On drop, the grid POSTs the appointment title to `/appointment/types` (reuses existing endpoint). The appointment's own position is NOT changed. The grid does NOT call its normal position-save flow for this drop.

**Rationale**: A move would be surprising and destructive. Copy matches user expectation — the type is a template derived from the appointment, not a relocation.

## Risks / Trade-offs

- **Gesture conflict**: If the user drags an appointment block, the normal move behavior still fires. Mitigation: check `isOverTypesPanel` before `isOverTrashcan` — if over types panel, skip position save and POST to create type instead. The appointment stays put.
- **Panel visibility**: The types panel is below the sidebar — might be scrolled out of view. Mitigation: if the panel has `overflow-y: auto` (it does), the hit test naturally fails (pointer can't be over a scrolled-away element). This is acceptable behavior.
