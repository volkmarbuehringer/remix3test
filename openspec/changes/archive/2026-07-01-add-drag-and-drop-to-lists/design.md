## Context

The `/lists` page lets users create and manage lists of text items. Items are stored as a JSONB array in PostgreSQL and rendered in a client-side `ListsClient` component (`app/assets/lists-client.tsx`). Currently, item reordering uses small ↑↓ arrow buttons — functional but cumbersome for moving items more than one position. The appointment grid (`app/ui/appointment-grid.tsx`) already uses a custom pointer-based drag system, but lists lives in a client entry with a different rendering model.

The existing component manages items as a reactive array (`items: ListItem[]`). Visual reordering (moveUp/moveDown, reverse, shuffle) happens by mutating array order, which is then persisted to the server on save/update. No data model changes are needed — array index already defines order.

## Goals / Non-Goals

**Goals:**
- Replace ↑↓ arrow buttons with drag-and-drop reordering using the HTML5 Drag and Drop API
- Add a visual drag handle (grip icon ⠿) as the activation zone on each item
- Show a drop indicator line between items while dragging
- Reduce opacity on the dragged item to indicate active drag state
- Preserve existing alternatives: ↑↓ buttons, reverse, shuffle, clear all
- Use zero external dependencies (native browser API)

**Non-Goals:**
- Cross-list drag and drop (moving items between different lists)
- Touch-based drag and drop (HTML5 DnD has poor mobile support; defer to a future enhancement)
- Dragging from outside the list (e.g., from a palette or external source)
- Server-side ordering or reordering API changes
- Changes to the data model or API

## Decisions

1. **HTML5 Drag and Drop API over pointer events**: The appointment grid uses a custom pointer-event drag system for complex positioned-based dragging. Lists need simple reordering within a flat list, which HTML5 DnD handles natively with `dragstart`, `dragover`, `drop`, and `dragend` events. Pointer events would require manual coordinate tracking and hit-testing — unnecessary complexity for this case.

2. **Drag handle as activation zone over whole-item drag**: Using a dedicated grip icon avoids accidental drag activation when clicking buttons or selecting text. The grip icon (⠿ or ≡) provides a clear visual affordance. The existing ↑↓, ✏️, 🗑️ buttons remain on the right; the grip sits on the left before the index badge.

3. **Optimistic reorder**: When a drop completes, immediately reorder the items array (same pattern as existing moveUp/moveDown). No optimistic server call — save/update is already explicit via the "Aktualisieren" button. This keeps the existing data flow intact.

4. **No new component extraction**: The drag logic stays in `lists-client.tsx` rather than extracting a generic `SortableList` component. The existing code is tightly integrated with the React-free Remix client entry pattern, and extraction would add indirection without reuse elsewhere.

## Risks / Trade-offs

- **HTML5 Drag and Drop is not touch-friendly** → Defer touch support; the ↑↓ buttons remain as a fallback for mobile users
- **Firefox requires `dragstart` to set `dataTransfer` data** → Always set `dataTransfer.setData('text/plain', ...)` even if unused, to satisfy the spec
- **`dragover` must call `e.preventDefault()`** → Required to allow dropping; easy to forget
- **Drag ghost image is browser-dependent** → Accept default ghost for now; custom ghost images can be added later
- **Potential visual glitch on rapid drags** → Debounce or guard `drop` handler to prevent race conditions on state
