## Why

Currently, appointments and offerings can be created or modified with dates in the past, which allows users to backdate bookings and admins to create retrospective entries. This can lead to data integrity issues, scheduling confusion, and potential misuse. The system needs guardrails to prevent past-date mutations while ensuring admins retain the ability to clean up past records via deletion.

## What Changes

- **Appointment create/update**: Reject any write where the appointment's `date` (or `date` + time) is in the past at the moment of submission, for both user-facing and admin controllers.
- **Offering create/update**: Reject any write where the offering's `day` is in the past at the moment of submission, in the admin controller.
- **Admin-only past deletion**: Only users with `role = 'admin'` may delete appointments and offerings whose date/day is in the past. Non-admin users attempting to delete past records will receive an error response.
- **Error messaging**: Return clear, user-facing error messages (in German, consistent with existing patterns) explaining that past records cannot be edited.
- **Schema-level validation**: Add a `validate` hook at the data-access layer (table schema level) to enforce past-date checks consistently across all access paths, with the admin deletion exception explicitly wired through.

## Capabilities

### New Capabilities

- `past-date-validation`: Cross-cutting validation rules that prevent creation and modification of appointments and offerings in the past, while allowing admin-only deletion of past records.

### Modified Capabilities

- `appointment-calendar`: Appointment create, update, and delete requirements need delta specs to add past-date guardrails and admin-only past-deletion rules.

## Impact

- **`newapp/app/data/schema.ts`**: Add `validate` hooks to both `appointments` and `appointoffering` table definitions for past-date checks.
- **`newapp/app/data/appointments.ts`**: Data access layer — add past-date validation in `createAppointment` and `updateAppointment`; add admin bypass for `deleteAppointment`.
- **`newapp/app/data/appointofferings.ts`**: Data access layer — add past-date validation in create/update operations.
- **`newapp/app/actions/appointment-controller.tsx`**: User-facing controller — add past-date check on create/update; restrict past deletion to admins.
- **`newapp/app/actions/admin-appointments-controller.tsx`**: Admin controller — add past-date check on create/update.
- **`newapp/app/actions/admin-offerings-controller.tsx`**: Admin controller — add past-date check on create/update; restrict past deletion to admins.
- **`newapp/app/actions/admin-appointments-controller.test.ts`**: Add test cases for past-date rejection and admin-only past deletion.
- **Language/UI**: Error messages in German per existing conventions.
- **Timezone**: Use server-side UTC for "now" comparison; dates are stored as epoch ms (UTC midnight), so comparison is straightforward.
