## 1. Layout solver

- [x] 1.1 Create `app/ui/schedule-layout.ts` — adapt Timeboxer's layout solver, replacing `dayOfWeek` (0-6) with `date` (epoch ms). Include `previewMoveBlock`, `previewResizeBlockTime`, `previewDeleteBlock` and all supporting functions (insertBlock, resolvePush, layoutBeforeAnchor, layoutAfterAnchor, collisions, validation, etc.)
- [x] 1.2 Add the adapted `AppointmentLayoutBlock` interface using `date: number` instead of `dayOfWeek: number`, matching the appointment data model (`id: number`, `title`, `date`, `start_min`, `end_min`)

## 2. Drag-and-drop

- [x] 2.1 Add drag state types and variables to the `clientEntry` setup function in `appointment-grid.tsx` (DragState with active, blockId, pointerId, startX/Y, offsetX/Y, grid measurement, original blocks, placement)
- [x] 2.2 Add `measureGrid()` function — reads grid container bounding rect, computes day width and row height
- [x] 2.3 Add `startDrag()` — called on `pointerdown` on appointment block, captures grid measurement, saves original blocks, stores pointer offset, binds window pointermove/pointerup
- [x] 2.4 Add `moveDrag()` — called on `pointermove`, calculates target day/time from pointer position, calls `previewMoveBlock` on layout solver, updates preview blocks
- [x] 2.5 Add `endDrag()` — called on `pointerup`, if moved and preview valid: applies preview blocks to schedule, sends PUT with new `date`, `start_min`, `end_min`, reloads page on success
- [x] 2.6 Add drag visual feedback: ghost block rendering (dashed border, opacity), `translate` CSS on dragged block for sub-cell offset, cursor change on container during drag

## 3. Resize

- [x] 3.1 Add resize state types and variables to the `clientEntry` setup function (ResizeState with active, blockId, edge, pointerId, startY, offsetY, grid measurement, original block/blocks)
- [x] 3.2 Create `ResizeHandle` component(s) — thin horizontal bars at top/bottom of each block, `ns-resize` cursor, visible on hover, `pointerdown` starts resize gesture
- [x] 3.3 Add `startResize()` — called on `pointerdown` on resize handle, captures grid measurement, saves original block, binds window pointermove/pointerup
- [x] 3.4 Add `moveResize()` — called on `pointermove`, calculates new edge minute from pointer, calls `previewResizeBlockTime` on layout solver, updates preview
- [x] 3.5 Add `endResize()` — called on `pointerup`, if moved and preview valid: applies preview, sends PUT with updated `start_min` or `end_min`, reloads page on success
- [x] 3.6 Ensure minimum 15-minute duration enforced by layout solver policy

## 4. Integration and cleanup

- [x] 4.1 Wire up `pointerdown` event on appointment blocks to start drag (preserving existing double-click for rename)
- [x] 4.2 Add gesture guard to prevent concurrent drag + resize + draft interactions
- [x] 4.3 Add CSS styles for resize handles, drag states, ghost blocks
- [x] 4.4 Add `touchAction: 'none'` on interactive elements to prevent scroll interference on touch devices
- [x] 4.5 Run `npm run typecheck` to confirm no type errors
- [ ] 4.6 Start dev server and verify `/appointment` renders and interactions work (manual)
