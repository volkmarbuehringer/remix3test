## Why

Users can already create appointments by dragging types from the panel to the calendar. The reverse flow is missing: dragging an existing appointment block onto the types panel should create a new type from its title. This completes the symmetry between types and appointments — either direction can bootstrap the other.

## What Changes

- When dragging an appointment block, if dropped over the types panel, a new type is created with the appointment's title
- The appointment itself stays unchanged (copy, not move)
- The types panel shows a visual drop zone when an appointment is being dragged over it
- The grid's existing drag gesture is extended with a new destination check (currently it only checks for the trashcan)

## Capabilities

### New Capabilities

- _(none — this extends existing capabilities)_

### Modified Capabilities

- `appointment-calendar`: Extend the drag gesture to detect drops on the types panel; add visual feedback when hovering the types area
- `appointtypes-crud`: Add drop zone state to the types panel that accepts appointment titles and creates new types

## Impact

- **Modified**: `app/ui/appointment-grid.tsx` — extend `endDrag` to POST to `/appointment/types` when dropped over types panel
- **Modified**: `app/ui/appointtype-panel.tsx` — add visual drop zone indicator
- **Modified**: `app/lib/appointtype-drag.ts` — add grid-to-panel drag state for the types panel to observe
- **No new routes or data modules** — reuses existing `POST /appointment/types` endpoint
