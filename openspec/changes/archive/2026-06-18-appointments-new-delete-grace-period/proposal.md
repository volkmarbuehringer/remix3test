## Why

The current 24h cancellation policy at `/appointments/new` prevents all non-admin users from deleting any appointment within 24h of its start time. This is too strict for newly created appointments — users who accidentally create an appointment or change their mind should be able to cancel immediately, regardless of the start time. A 10-minute grace period from creation addresses this without weakening the general cancellation policy.

## What Changes

- **Destroy action** (`DELETE /appointments/new/:id`): Allow deletion if the appointment was created less than 10 minutes ago, even if the start time is within 24h.
- **Admin override preserved**: Admins continue to bypass all restrictions.
- **UI**: Adjust the `blocked` flag computation in the data loader to account for the grace period — rows created within 10 minutes should show the delete button even if within 24h.
- No changes to the existing 24h start-time check beyond adding the grace period exception.

## Capabilities

### New Capabilities

- `delete-grace-period`: A 10-minute grace window after appointment creation during which the cancellation policy is bypassed for non-admin users.

### Modified Capabilities

- `24h-cancellation-policy`: The existing 24h delete restriction gains a grace-period exception for newly created appointments.

## Impact

- `app/actions/appointments-new/controller.tsx`: Update `destroy` action query to fetch `created_at`, add grace period check to the 24h guard condition.
- `app/ui/appointments-new-page.tsx`: No changes needed (blocked flag recomputed server-side, UI already adapts).
- `app/actions/appointments-new/controller.test.ts`: Add tests for the grace period scenario.
