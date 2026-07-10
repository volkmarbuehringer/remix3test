## Context

The appointment calendar currently supports manual creation by clicking a time slot and typing a title. There is no reusable catalog of appointment types. Users need to type the same titles repeatedly (Massage, Consultation, Follow-up, etc.). This design adds an `appointtypes` table with a types management panel loaded as a Remix Frame below the sidebar, enabling drag-and-drop creation of appointments from type templates.

The existing architecture uses:

- `remix/data-table` for schema definitions and CRUD
- `remix/ui` with `clientEntry` for interactive client-side components
- `remix/ui/menu` for context menus
- Custom pointer-event-based drag system in the grid
- Frame-based navigation with partial HTML fragment loading

## Goals / Non-Goals

**Goals:**

- New `appointtypes` table with user-scoped type catalog
- Inline CRUD: add (inline input), rename (click-to-edit), delete (context menu)
- Types panel renders as a Remix Frame below the appointment sidebar
- Drag a type from the panel onto the calendar creates an appointment (60 min duration)
- Server-side copy via `INSERT INTO appointments(...) SELECT ... FROM appointtypes`
- Drag visual follows existing grid patterns (ghost block, snap to hours)

**Non-Goals:**

- Per-type default duration (always 60 min for now, extendable later)
- Color or other metadata columns on appointtypes
- Reordering or sorting controls (alphabetical order only)
- Drag reordering of types in the panel itself
- Multi-user type sharing

## Decisions

### 1. Frame-based loading for types panel

**Decision**: Use a Remix `<Frame>` loading `/appointment/types` as a fragment. The appointment page layout becomes a flex column in the left sidebar area, with the existing sidebar on top and the Frame below.

**Rationale**: The user explicitly requested a "remix frame." This also keeps the types panel independently loadable, cacheable, and refreshable. Since Frame content shares the same document, drag events flow seamlessly between Frame and main grid.

### 2. Shared module for drag bridge

**Decision**: A simple shared module (`appointtype-drag.ts`) exports a mutable `typeDragState` object set by the types panel on `pointerdown` and read by the grid in its existing `onWindowPointerMove`/`onWindowPointerUp` handlers.

**Rationale**: Avoids coupling the types panel to the grid. The grid already has a centralized window pointer event handler — extending it to check `typeDragState` is minimal. The module lives in `app/lib/`.

### 3. Server-side INSERT...SELECT

**Decision**: When a type is dropped on the grid, the client POSTs `{ typeId, date, start_min }` to `/appointment`. The controller does:

```sql
INSERT INTO appointments (user_id, title, date, start_min, end_min, created_at, updated_at)
SELECT user_id, title, $2::bigint, $3::integer, $3 + 60, $4, $4
FROM appointtypes WHERE id = $1 AND user_id = $authUserId
RETURNING id
```

**Rationale**: The type's `user_id` is authoritative. Using `SELECT ... FROM appointtypes` ensures consistency — no client can pass a mismatched title. The `user_id` filter on the type doubles as an authorization check.

### 4. Inline CRUD for types

**Decision**: All type management happens inline in the types list:

- **Add**: [+ Add Type] button adds a new row with an `<input>` focused
- **Edit**: Click on a type title switches it to an `<input>` (same pattern as appointment rename)
- **Delete**: Right-click → context menu → "Löschen" → confirm

**Rationale**: Matches existing patterns in the app (appointment rename = inline input, admin/nutzer = context menu). No modal or separate form needed.

### 5. Custom pointer events for type drag

**Decision**: The types panel uses `pointerdown` to initiate drag (same as grid), not HTML5 Drag and Drop API. On `pointermove`, if the cursor is over the grid, a ghost block is rendered.

**Rationale**: The user requested "like existing." The grid already uses custom pointer events with ghost blocks, snap-to-hour, and visual feedback. HTML5 DnD would have a different visual feel and separate event system.

### 6. Drag visual: ghost block with 60 min duration

**Decision**: The ghost block during drag shows a 60-minute span at the snapped position. It mirrors the existing ghost block style used during appointment move/resize.

**Rationale**: Consistent UX. The ghost tells the user exactly where and how long the appointment will land.

## Risks / Trade-offs

- **Frame loading latency**: The types Frame loads independently. On slow connections, there may be a flash. Mitigation: the frame is small and loads a simple query.
- **Gesture conflict**: The type drag uses the same `onWindowPointerMove` as the grid's internal drag/resize. Mitigation: `typeDragState` is checked first in the handler, before the existing gesture dispatch, so it never conflicts.
- **Frame re-render on create/delete**: After adding or deleting a type, the Frame needs to reload. Mitigation: use `handle.frame?.reload()` on the Frame element, same pattern as the nutzer CRUD.
