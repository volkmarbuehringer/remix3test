## Why

The appointment calendar currently exposes full appointment titles for all users' appointments on the shared grid, including those belonging to other users. This raises privacy concerns — users should not see the details of others' appointments, only an unobtrusive indicator that the slot is taken. Additionally, the booking system needs a cancellation policy — users are committed to pay and can only cancel up to 24 hours before the scheduled appointment time. Finally, admins need the ability to manage appointments on behalf of other users directly from the user-facing appointment page, not just the admin panel.

## What Changes

- **Foreign appointment privacy**: Non-admin users see only a colored area (without title text, without hover tooltip) for appointments belonging to other users on the `/appointments` grid. The title and details are visible only for the user's own appointments.
- **Admin sees all with full interactivity**: Admin users see all appointments with full details (titles, etc.) and can interact (edit, delete) any appointment directly from the `/appointments` page, not just from the admin panel.
- **Cancellation policy — 24h before appointment**: Normal users can update or delete an appointment **only if its scheduled start time is at least 24 hours in the future**. If the appointment is less than 24 hours away (or already started), modification and cancellation are blocked. This enforces the booking commitment: you can cancel up to 24h before.
- **Create unchanged — today/future only**: Creating new appointments in the past remains blocked (same as current `isDateInPast()` day-level check). The 24h rule does not affect creation.
- **Admin bypass for update/delete**: Admin users can update and delete any appointment (not just their own) from the user-facing appointment page. The server-side ownership check and the 24h cancellation check are bypassed for admins.
- **Admin SSE invalidation**: Admin mutations on the user-facing page trigger SSE invalidation so the grid refreshes for all connected clients.

## Capabilities

### New Capabilities

- `appointment-privacy`: Privacy rules for the shared appointment grid — what non-admin users see of others' appointments.

### Modified Capabilities

- `past-date-validation`: Change past-date comparison from "today at midnight" to "24 hours before current time" for both appointments and offerings.
- `appointment-calendar`: Add admin permissions for update/delete on the user-facing page; modify foreign block rendering to hide title/tooltip for non-admins.

## Impact

- **`app/utils/date-utils.ts`**: Add `isWithinHours(epochMs, hours): boolean` that checks if `epochMs - Date.now() >= hours * 3600000` (forward-looking). Keep `isDateInPast()` unchanged for create checks.
- **`app/data/appointments.ts`**: `updateAppointment` and `deleteAppointment` — add cancellation-policy check: appointment start time (`date + start_min * 60000`) must be at least 24h in the future for non-admin users. `createAppointment` keeps day-level `isDateInPast()` unchanged.
- **`app/data/appointments.ts`**: Add `adminBypass` option to `updateAppointment()`; `deleteAppointment()` already has it.
- **`app/actions/appointment-controller.tsx`**: Update `destroy` and `update` actions to skip `user_id` scope when admin; pass `adminBypass` option to DAL; add role detection.
- **`app/ui/appointment-page.tsx`**: Pass `isAdmin` flag to embedded data so the client-side grid can adjust visibility.
- **`app/ui/appointment-grid.tsx`**: Update foreign block rendering — hide title and hover tooltip for non-admin users; show full details for admin users; enable interaction (edit/delete) for admin on any block.
- **Admin controllers** — no changes needed for the 24h cancellation rule (admins bypass it). Past-date creation checks (day-level) remain unchanged.
- **Tests**: Update appointment grid tests to reflect new privacy, permission, and cancellation policy behavior.
