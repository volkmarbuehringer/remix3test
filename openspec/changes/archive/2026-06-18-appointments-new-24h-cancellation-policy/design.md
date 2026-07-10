## Context

The `/appointments/new` route (user-facing appointments page) allows authenticated users to view, create, edit, and delete their own appointments. Currently, editing and deletion have a simple past-date check (`appointmentStartMs <= Date.now()`), but no restriction for upcoming appointments within the next 24 hours. The `isWithinHours()` utility already exists in `app/utils/date-utils.ts` returning `epochMs - Date.now() >= hours * 3600000`.

The admin-facing route (`verwaltung/appointments`) is intentionally excluded — admins manage all appointments and need override capability.

## Goals / Non-Goals

**Goals:**

- Prevent non-admin users from updating appointments at `/appointments/new` when start time < 24h from now
- Prevent non-admin users from deleting appointments at `/appointments/new` when start time < 24h from now
- Hide/disable the Bearbeiten and Löschen buttons in the UI for affected rows
- Show a clear German error message explaining the restriction

**Non-Goals:**

- This does NOT affect the admin `verwaltung/appointments` controller — admins retain full edit/delete access
- This does NOT affect the create flow — new appointments can still be created freely
- This does NOT send email notifications or implement a cancellation fee — pure server+UI gate

## Decisions

1. **Use existing `isWithinHours()` utility** — already defined in `date-utils.ts`, takes `(epochMs, hours)` and returns `true` if at least `hours` away. The check is `!isWithinHours(appointmentStartMs, 24)` → reject.

2. **Server-side enforcement in controller actions** — the `update` and `destroy` actions in `app/actions/appointments-new/controller.tsx` will fetch the current appointment row (for destroy, the row isn't loaded yet; for update, start_min is in the form data but the date may have been changed). Both need to compute the appointment's actual start time from the database row before allowing the operation.

3. **UI-side hiding of action buttons** — in `appointments-new-page.tsx`, each row's edit/delete buttons will be conditionally rendered based on a `cancellationBlocked` flag computed from `row.date` and `row.start_min`. If the appointment starts within 24h, buttons are hidden and a locked icon is shown instead.

4. **Error message wording** — German: "Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden."

5. **Single error path in destroy** — The destroy action currently uses `errorRedirectDestroy()` helper. The new check will follow the same pattern with a dedicated error message.

## Risks / Trade-offs

1. **Clock skew** — The check uses server `Date.now()`, so clients with different clocks see no difference. This is correct: server time is authoritative.
2. **Race condition** — A user could load the page just before the cutoff, see buttons enabled, then submit after the cutoff. The server check catches this and returns an error. The UI guard is a UX improvement, not a security boundary.
3. **Existing appointments** — All existing appointments within the 24h window will immediately become non-editable/non-deletable on deploy. No data migration needed.
