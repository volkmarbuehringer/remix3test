## 1. Drag Handle UI

- [x] 1.1 Add grip icon (⠿ or ≡) to each list item's left edge, before the index badge
- [x] 1.2 Set `cursor: grab` on the grip handle and `cursor: grabbing` while dragging
- [x] 1.3 Set `draggable="true"` on each list item

## 2. Drag and Drop Logic

- [x] 2.1 Add `dragStart` handler: set `dataTransfer` data, add reduced opacity class, track dragged item index
- [x] 2.2 Add `dragOver` handler: `preventDefault()` to allow drop, calculate drop position, show indicator line
- [x] 2.3 Add `drop` handler: reorder `items` array to insert dragged item at drop position, call `handle.update()`
- [x] 2.4 Add `dragEnd` handler: remove drag-related CSS classes, reset state

## 3. Drop Indicator Visual

- [x] 3.1 Add CSS for a horizontal drop indicator line between items
- [x] 3.2 Show/hide the indicator based on `dragOver` state at each position
- [x] 3.3 Add reduced opacity style for the actively dragged item

## 4. Cleanup and Testing

- [x] 4.1 Run typecheck to ensure no TypeScript errors
- [x] 4.2 Run existing list controller tests to confirm no regressions
- [ ] 4.3 Manual verification: drag reorder, Escape cancel, drop outside cancel, ↑↓ buttons still work
  - Manual: start the app and test in browser
