## Context

The appointment calendar at `/appointments` shows a weekly grid with appointment blocks for all users on a shared resource. Currently:

1. **All appointment data is sent to the client** — including titles, user IDs, and time ranges for every appointment on the selected week+resource. The client distinguishes "own" vs. "foreign" by comparing `user_id` against `currentUserId`. Foreign blocks already render with a purple tint and reduced interactivity (no drag/resize/edit), but still show the appointment title text and a hover tooltip.

2. **Past-date guard** uses `isDateInPast()` which compares against UTC midnight of today (`Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())`). This means any date before today (even 23:59 yesterday) is rejected.

3. **User-facing controller** scopes update and delete by `user_id` — a user can only modify their own appointments. Admins use a separate controller at `/admin/appointments`.

## Goals / Non-Goals

**Goals:**

- Non-admin users see only a colored area (no title, no tooltip) for other users' appointment blocks on the grid
- Admin users see all appointment details and can interact with any block (edit, delete, resize, drag) directly from the user-facing `/appointments` page
- Relax the past-date creation/update boundary from "today at midnight" to "24 hours before current time"
- Admin bypass for update/delete on the user-facing controller — admins can modify any appointment
- SSE invalidation triggered for admin mutations on the user-facing page

**Non-Goals:**

- Not changing the admin panel (`/admin/appointments`) — admins already have full access there
- Not adding a separate "read-only" permission level beyond what exists
- Not modifying the offerings past-date guard for non-admin paths (admin-only for offerings anyway)
- Not adding user-level color coding for foreign blocks (stays as a single neutral tint)
- Not adding confirmation dialogs for admin operations on foreign appointments

## Decisions

### 1. Cancellation policy: Forward-looking 24h check for update/delete

**Decision**: Keep `isDateInPast(epochMs)` unchanged for **create** operations (day-level check against UTC midnight). Add a new `isWithinHours(epochMs: number, hours: number): boolean` for **update/delete** operations — checks if `epochMs - Date.now() >= hours * 3600000` (i.e., the appointment is at least `hours` away in the future).

- **CREATE**: Uses existing `isDateInPast(input.date)` — rejects if the day-level date is before today's UTC midnight. Unchanged. Users can create appointments for today or any future date.
- **UPDATE/DELETE**: Computes the appointment's scheduled start time as `appointmentStartMs = date + start_min * 60000` (all UTC). Then checks `isWithinHours(appointmentStartMs, 24)`. If the appointment is fewer than 24 hours away (or already started), the update/delete is rejected for non-admin users. This enforces the booking cancellation policy.

**Rationale**:

- **Booking policy**: The rule is "you can cancel up to 24h before the appointment". This is naturally expressed as a forward-looking check: `appointmentStartMs - Date.now() >= 24h`.
- **Not about past dates**: The 24h window is not about how old the appointment is — it's about how much time remains before it starts. An appointment created 5 minutes ago for next week is 100% editable. An appointment created 3 days ago for 1 hour from now is locked.
- **Admin bypass**: Admins can always update/delete regardless of the 24h window. This is enforced by passing `adminBypass: true` in the DAL options, which skips the check entirely.

**Alternative considered**: Checking how old the appointment record is (created_at) — rejected because the policy is about the scheduled time, not when the record was created.

### 2. Foreign appointment privacy: Server-side `isAdmin` flag

**Decision**: Pass `isAdmin: boolean` in the embedded JSON alongside `currentUserId`. The appointment controller detects admin role from `auth.identity.role`.

**Rationale**:

- The client already has the `currentUserId` for distinguishing own vs. foreign — adding a single boolean is minimal
- Avoids a separate API call or permission endpoint
- The decision of what to show is a client concern based on role + ownership

**Client behavior**:

- Non-admin viewing foreign block: render as solid colored area (no title text, no hover tooltip, cursor default)
- Admin viewing any block: render full details (title, hover, all interaction)

### 3. Admin bypass for user-facing update/delete

**Decision**: Add `{ adminBypass?: boolean }` option to `updateAppointment()` in `data/appointments.ts`, mirroring the existing pattern in `deleteAppointment()`. The user-facing controller detects admin role and passes `adminBypass: true`.

**Rationale**:

- The existing `deleteAppointment()` already has the `adminBypass` pattern — extending to `updateAppointment()` is consistent
- The DAL functions handle ownership scoping: `updateAppointment` currently queries `{ id: appointmentId, user_id: userId }`. With `adminBypass`, it skips the `user_id` filter.
- The controller already has access to `auth.identity.role` — no new middleware needed

### 4. Create appointment from type — admin bypass needed too

**Decision**: The typeId-based creation path (raw SQL INSERT...SELECT) currently scopes to the user's own types via `user_id = $5`. For admin creating appointments on behalf of others, this path should also support an admin bypass. However, this flow is primarily used for drag-from-types-panel which is a personal action — skip this for now unless explicitly needed.

### 5. SSE invalidation for admin mutations

**Decision**: When an admin creates/updates/deletes an appointment via the user-facing controller, broadcast `appointmentChannel.broadcast('invalidate')` as currently done for user operations. No change needed — the controller already broadcasts after every mutation.

**For admin-specific mutations** (updating/deleting foreign appointments): The existing broadcasts in the controller already fire after `updateAppointment` and `deleteAppointment` calls. Since the controller code path is the same (just with different params), the broadcast is automatic.

### 6. Timezone consideration for 24h cancellation window

**Decision**: Use server UTC time (`Date.now()`) for the 24h comparison. Appointment start time is computed as `date + start_min * 60000` (both in UTC). The check is `appointmentStartMs - Date.now() >= 24 * 3600000`.

**Edge cases**:

- Appointment at 4:00 PM tomorrow, it's now 10:00 AM today → 30 hours away → editable
- Appointment at 9:00 AM tomorrow, it's now 10:00 AM today → 23 hours away → locked
- Appointment at 2:00 PM today, it's now 1:00 PM today → 1 hour away → locked
- Appointment that already started → `startMs - now < 0 < 24h` → locked

**Note**: The 24h cancellation policy only applies to update and delete operations. Create operations use the existing day-level `isDateInPast()` check (today or future only). Admin controllers have no 24h check — admins can always update/delete.

## Risks / Trade-offs

- **Risk**: Non-admin users see "empty" colored blocks without knowing who booked the slot.
  → **Mitigation**: This is intentional — privacy is the goal. The colored area communicates "slot taken" without revealing details.

- **Risk**: Admin bypass for update removes the `user_id` scope, meaning an admin could accidentally update the wrong appointment.
  → **Mitigation**: The admin must explicitly target an appointment by ID. The same risk exists in the admin panel. The benefit of unified management outweighs the minor risk.

- **Risk**: The 24h cancellation window is a forward-looking check — users close to deadline cannot cancel.
  → **Mitigation**: This is the intended booking policy. Error messages should clearly communicate "Cancellation only possible up to 24 hours before the appointment."

- **Trade-off**: Adding the 24h check to the DAL for update/delete means the DAL needs the appointment's `start_min` to compute the appointment start time. `deleteAppointment` currently only has the appointment ID and user ID.
  → **Accept**: The DAL already fetches the full appointment record in both `updateAppointment` and `deleteAppointment` to verify ownership, so `start_min` (a generated column from `during`) is readily available from the fetched record.

- **Trade-off**: Removing title text from foreign blocks reduces utility of the grid for non-admin users (they can't see what's happening, only that something is happening).
  → **Accept**: This is the explicit privacy requirement. Users who need full visibility should be granted admin access.

- **Trade-off**: The `isDateInPast()` check remains for create operations, meaning you cannot create an appointment for a past day even if the slot time hasn't started yet.
  → **Accept**: This is the explicit user requirement — "in the past can no new appointment scheduled". Users can still schedule ad hoc appointments for "now" (today).
