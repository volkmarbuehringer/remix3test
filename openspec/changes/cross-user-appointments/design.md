## Context

The appointment calendar currently uses a `listAppointmentsByWeek` query that filters by `user_id`, so users only see their own appointments. The database already has a **global** overlap constraint (`date WITH =, during WITH &&` in `setup.ts` — no `user_id` filter), but since users never see each other's appointments, they can't tell when they'd create a conflict.

The existing client-side layout solver (`schedule-layout.ts`) treats all blocks as shiftable during drag/resize conflict resolution. With cross-user visibility, foreign blocks must become fixed obstacles that the solver cannot move.

The `appointments` table will be dropped and recreated — `setup.ts` already creates the table with the correct global constraint, so no schema migration is needed.

## Goals / Non-Goals

**Goals:**
- All authenticated users can see all appointments on the calendar.
- Foreign appointments are visually distinct (different color/opacity/border).
- Foreign appointments are read-only: no drag, resize, inline edit, or delete.
- Own appointments remain fully interactive (no regression).
- Server-side ownership enforcement for mutations stays unchanged.
- Create new appointments (for self) continues to work the same way.
- The layout solver treats foreign blocks as fixed obstacles — dragging/resizing an own block into a foreign block results in `unresolved` (snap back).

**Non-Goals:**
- No ability to edit or manage other users' appointments.
- No user-filtering or user-select UI in this change.
- No permission roles (admin vs regular) differentiation.
- No real-time updates or SSE for foreign appointment changes.
- No changes to appointtypes ownership or visibility.
- No database schema changes (table drop+recreate is handled by the user, `setup.ts` creates the correct schema).

## Decisions

### Decision 1: Add `listAllAppointmentsByWeek()` — separate function, no migration

**Choice**: Add a new `listAllAppointmentsByWeek(db, weekStart, weekEnd)` alongside the existing `listAppointmentsByWeek()`. No existing function is changed.

**Rationale**: The table will be dropped and recreated by the user. The `setup.ts` schema already has the global constraint. The new query simply omits the `user_id` WHERE clause.

### Decision 2: Pass `currentUserId` through embedded JSON data

**Choice**: The server embeds `currentUserId` alongside the appointment data in the `<script id="appointment-data">` JSON. The client-side `AppointmentGrid` reads it from `AppData.currentUserId`.

**Rationale**: The existing pattern already embeds server data as JSON for the client entry. Adding one more field is the simplest, most consistent approach.

### Decision 3: Add `user_id` to `AppointmentLayoutBlock`

**Choice**: Extend the `AppointmentLayoutBlock` interface with `user_id: number` so the client can check ownership per block. The solver uses this to distinguish shiftable (own) vs fixed (foreign) blocks.

**Rationale**: The server has `user_id` from the database. Including it enables both the grid's interaction guards and the solver's obstacle detection without additional API calls.

### Decision 4: Style foreign blocks with a muted/different color scheme

**Choice**: Foreign blocks get a visually distinct treatment using `css()` mixins — lighter background, a colored left-border accent, and `cursor: default`.

**Rationale**: Clear at-a-glance ownership cue without being distracting or taking too much space.

### Decision 5: Interaction guards at the event handler level

**Choice**: Each interaction handler checks `appt.user_id === currentUserId` and short-circuits for foreign blocks.

**Rationale**: Defensive — even if CSS hints at non-interactivity, JS enforces it. Server-side ownership checks remain unchanged as the safety net.

### Decision 6: Layout solver treats foreign blocks as fixed obstacles

**Choice**: `previewMoveBlock` and `previewResizeBlockTime` in `schedule-layout.ts` receive `currentUserId` (or blocks carry `user_id`). During shift resolution, blocks where `user_id !== currentUserId` are never moved. If a proposed placement would overlap a foreign block, the solver returns `unresolved: true`.

**Rationale**: The existing solver shifts all blocks to resolve overlaps. With a global DB constraint, an overlap with a foreign block would be rejected by the server anyway. Preventing it on the client avoids a failed save and provides immediate UX feedback.

**Alternatives considered**:
- Filter foreign blocks out of the solver entirely — loses obstacle detection, solver could produce a layout that conflicts with a foreign block.
- Server-only enforcement — UX is worse (save fails, user reloads confused).

## Risks / Trade-offs

- **[Global overlap constraint]** The existing constraint in `setup.ts` is `EXCLUDE USING GIST (date WITH =, during WITH &&)` — already global, no `user_id`. No schema change needed. The constraint prevents ANY overlap on the same date, across all users.
- **[Performance]** Fetching all appointments vs one user's. Mitigation: 7-day window, typical users <100, negligible.
- **[Data exposure]** All users see all appointment titles/times. Mitigation: Intended design for team coordination. No sensitive data in appointments table.
- **[Layout solver complexity]** The solver must now know which blocks are shiftable. Mitigation: Adding `user_id` to the block type and checking `!== currentUserId` is a single boolean check per block.
- **[Client-side enforcement only for interactions]** Server still enforces ownership on mutations. If a malicious actor sends a PUT for a foreign appointment, the server correctly rejects it.
- **[Table drop needed]** The user will drop the `appointments` table — no migration script needed. `setup.ts` recreates it with the correct constraint on next startup. Existing data is lost (acceptable for development).
