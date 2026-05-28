## Why

The appointment calendar weekly grid (Phase 1) supports create, rename, and delete but lacks drag-and-drop and resize — the most natural interaction patterns for a calendar. Users cannot reposition appointments by dragging to different days/times or adjust duration by dragging block edges. The spec already defines these behaviors (drag to move, resize duration, conflict resolution) but they were deferred to Phase 2.

## What Changes

- Appointment blocks become drag-and-drop: users can drag blocks across days and times with visual ghost feedback, collision resolution via layout solver, and PUT save on drop
- Appointment blocks gain vertical resize handles on top/bottom edges: users can drag to change duration (minimum 15 minutes), with PUT save on release
- Layout solver (pure function, ported from Timeboxer demo) handles overlap resolution via cost-based algorithm, ensuring no overlapping blocks after drop/resize
- Existing interactions (click-to-create, double-click rename, hover delete) remain unchanged

## Capabilities

### New Capabilities

- `appointment-calendar`: Extends existing spec with drag-and-drop and resize requirements. No new spec needed — the existing spec already defines these scenarios.

### Modified Capabilities

- `appointment-calendar`: Adds implementation-specific details for drag-and-drop (pointer event handling, grid measurement, layout solver integration) and resize (edge handle rendering, minimum duration enforcement)

## Impact

- **app/ui/appointment-grid.tsx**: Major extension (~+350 lines) — add drag state machine, resize state machine, grid measurement, pointer event handlers
- **app/ui/schedule-layout.ts**: New file — adapted layout solver pure function from Timeboxer (replaces `dayOfWeek` with `date` epoch ms)
- No changes to: controller, data layer, routes, sidebar, page shell, nav
