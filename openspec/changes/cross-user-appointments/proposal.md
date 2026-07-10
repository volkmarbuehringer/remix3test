## Why

Currently, the appointment calendar only shows the current user's own appointments. Team members cannot see each other's schedules, making it impossible to coordinate availability or understand team workload at a glance. This change enables cross-user visibility while preserving data integrity — other users' appointments are view-only.

Additionally, the database already has a **global** overlap constraint (`EXCLUDE USING GIST (date WITH =, during WITH &&)`) — no two appointments can overlap on the same date regardless of user. Users need to see all appointments to know when they'd create a conflict.

## What Changes

- **Appointment listing**: The `/appointment` page now shows ALL users' appointments for the selected week, not just the current user's.
- **Visual differentiation**: Appointments belonging to other users are rendered in a distinct color/style with cursor feedback.
- **Read-only for foreign appointments**: Other users' appointments cannot be dragged, resized, edited, or deleted. Only the current user's own appointments remain fully interactive.
- **Layout solver treats foreign blocks as obstacles**: When dragging/resizing an own block, the solver will not shift foreign blocks. Overlaps with foreign blocks are detected as unresolvable and the operation is prevented.
- **Create restriction**: New appointments are created for the current user only (no change to create behavior).
- **Server-side ownership enforcement**: The existing `user_id` check on `PUT`/`DELETE` routes remains unchanged — these operations continue to be scoped to the current user's own appointments. The global DB constraint prevents any overlap regardless of user.
- **Table drop + recreate**: The `appointments` table will be dropped and recreated. `setup.ts` already creates it with the correct global constraint — no schema migration needed.

## Capabilities

### New Capabilities

- `cross-user-visibility`: View appointments of all users in the weekly grid, with visual distinction of ownership and read-only interaction for foreign appointments.

### Modified Capabilities

- `appointment-calendar`: The `listAppointmentsByWeek` query removes the `user_id` filter (for listing only). The frontend `AppointmentGrid` component gains the ability to differentiate blocks by user identity and restrict interactions accordingly. The layout solver treats foreign blocks as fixed obstacles.

## Impact

- **`app/data/appointments.ts`**: Add `listAllAppointmentsByWeek()` — same week-scoped query without `user_id` filter.
- **`app/actions/appointment-controller.tsx`**: `index` action — switch to new listing function; pass `currentUserId` to UI.
- **`app/ui/appointment-page.tsx`**: Pass `currentUserId` into the embedded JSON data.
- **`app/ui/appointment-grid.tsx`**: Add `user_id` to block type; add `currentUserId` to `AppData`; style foreign blocks; disable interactions on foreign blocks.
- **`app/ui/schedule-layout.ts`**: Add `user_id` to `AppointmentLayoutBlock`; modify solver to never shift foreign blocks and return `unresolved` on overlap with foreign blocks.
- **No schema migration**: Constraint is already global in `setup.ts`. Table dropped + recreated by user.
- **No auth changes**: `requireAuth()` middleware stays. Ownership enforcement on mutations is unchanged.
