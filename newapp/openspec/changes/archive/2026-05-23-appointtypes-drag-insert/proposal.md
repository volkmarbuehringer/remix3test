## Why

Currently, appointments must be created one by one by clicking on a time slot and typing a title. There's no reusable catalog of appointment titles. Users often create the same types of appointments repeatedly (massage, consultation, follow-up, etc.) — this drag-and-drop system eliminates repetitive typing and enables a faster workflow.

## What Changes

- New `appointtypes` database table: `id, user_id, title, created_at, updated_at`
- New `/appointment/types` route tree with CRUD endpoints (JSON API)
- New Remix `<Frame>` in the appointment page, below the sidebar, showing the types list
- Types list is a client entry with inline add (inline input), inline edit (click-to-rename), context menu (right-click → Bearbeiten/Löschen)
- Dragging a type from the types frame onto the calendar grid creates a new appointment with the type's title (default 60 min duration)
- The copy mechanism uses `INSERT INTO appointments(...) SELECT ... FROM appointtypes` on the server side

## Capabilities

### New Capabilities
- `appointtypes-crud`: Manage appointment types — list, create (inline), update (inline rename), delete (context menu)

### Modified Capabilities
- `appointment-calendar`: Add drag-from-type behavior to the existing grid; add types frame to the appointment page layout

## Impact

- **New table**: `appointtypes` — auto-created in `setup.ts`
- **New routes**: `/appointment/types` (index, create, update, destroy)
- **New controller**: `appointtype-controller.tsx`
- **New data module**: `data/appointtypes.ts`
- **New UI**: `ui/appointtype-panel.tsx` (client entry with inline CRUD + drag source)
- **Modified**: `ui/appointment-page.tsx` (add Frame below sidebar), `ui/appointment-grid.tsx` (add drop zone), `schema.ts`, `routes.ts`, `router.ts`, `setup.ts`
