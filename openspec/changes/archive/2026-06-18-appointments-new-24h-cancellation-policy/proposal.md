## Why

Users can currently edit or delete appointments at `/appointments/new` even when the appointment starts in under 24 hours. This enables last-minute cancellations and changes that disrupt scheduling reliability. A 24-hour cutoff protects resource planning and prevents abuse.

## What Changes

- **Update action** (`PUT /appointments/new/:id`): Reject updates when the appointment's start time is less than 24h from now, showing a German-language error message.
- **Delete action** (`DELETE /appointments/new/:id`): Reject deletions when the appointment's start time is less than 24h from now, showing a German-language error message.
- **UI**: Hide or disable the Bearbeiten and Löschen action buttons for rows whose appointment start time is within the 24h window.
- The `isWithinHours()` utility already exists in `app/utils/date-utils.ts` — no new utility needed.
- The `past-date-validation` spec already references a 24h cancellation policy (line 9) — this change implements that policy for the user-facing appointments page.

## Capabilities

### New Capabilities

- `24h-cancellation-policy`: Rules that prevent non-admin users from editing or deleting appointments at `/appointments/new` when the start time is less than 24 hours from now.

### Modified Capabilities

- `past-date-validation`: The existing past-date restriction on updates is superseded by the more nuanced 24h-window check for the `/appointments/new` route.
- `appointments-new-page`: The action buttons row must respect the 24h policy (hide/disable buttons when within window).

## Impact

- `app/actions/appointments-new/controller.tsx`: Add 24h checks in `update` and `destroy` actions
- `app/ui/appointments-new-page.tsx`: Conditionally hide/disable edit/delete buttons based on appointment start time
- `app/actions/appointments-new/controller.test.ts`: Add tests for 24h rejection scenarios
