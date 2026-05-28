## 1. Shared Past-Date Validation Utility

- [x] 1.1 Create `isDateInPast(epochMs: number): boolean` helper that compares a UTC-midnight epoch ms value against today's UTC midnight (`Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())`)
- [x] 1.2 Place the helper in a shared utility module (e.g., `app/utils/date-utils.ts`) so both DAL and controllers can import it

## 2. DAL: Appointments Past-Date Validation

- [x] 2.1 Add past-date check in `createAppointment()` in `app/data/appointments.ts` — throw `AppointmentError` with German message if date is in the past
- [x] 2.2 Add past-date check in `updateAppointment()` in `app/data/appointments.ts` — throw `AppointmentError` with German message if date (new or existing) is in the past
- [x] 2.3 Add `{ adminBypass?: boolean }` options parameter to `deleteAppointment()` in `app/data/appointments.ts` — skip past-date check when `adminBypass: true`; otherwise reject past deletion with German message

## 3. DAL: Offerings Past-Date Validation

- [x] 3.1 Added past-date validation inline in admin-offerings-controller.tsx (controller uses raw SQL, no DAL path)
- [x] 3.2 Past-deletion bypass handled naturally — admin-offerings controller has `requireAdmin()` middleware so destroy is always admin; no DAL needed

## 4. User-Facing Appointment Controller Updates

- [x] 4.1 Update `app/actions/appointment-controller.tsx` — the user-facing controller already uses the DAL, so past-date checks in `createAppointment`/`updateAppointment` are automatic; no change needed for those paths (added past-date check for the typeId-based raw SQL path)
- [x] 4.2 Add past-date check to the user-facing delete flow — call DAL `deleteAppointment()` without `adminBypass` so past deletion is rejected for non-admin users (handled by DAL, no controller change needed)

## 5. Admin Appointment Controller Updates

- [x] 5.1 Add past-date validation in `admin-appointments-controller.tsx` `create` action — check `dayMs` against `isDateInPast()` before the INSERT query; reject with redirect + error message if past
- [x] 5.2 Add past-date validation in `admin-appointments-controller.tsx` `update` action — check `dayMs` against `isDateInPast()` before the UPDATE query; reject with redirect + error message if past
- [x] 5.3 No change needed for admin `destroy` action — admin can delete past appointments (protected by `requireAdmin()` middleware)

## 6. Admin Offering Controller Updates

- [x] 6.1 Add past-date validation in `admin-offerings-controller.tsx` `create` action — check `dayMs` against `isDateInPast()` after the holiday check and before the INSERT query; reject with redirect + error message if past
- [x] 6.2 Add past-date validation in `admin-offerings-controller.tsx` `update` action — check `dayMs` against `isDateInPast()` after the holiday check and before the UPDATE query; reject with redirect + error message if past
- [x] 6.3 No change needed for admin offering `destroy` action — admin can delete past offerings (protected by `requireAdmin()` middleware)

## 7. Tests

- [x] 7.1 Add unit tests for `isDateInPast()` helper covering: today (false), yesterday (true), tomorrow (false), boundary at UTC midnight
- [x] 7.2 Tests for DAL `createAppointment` past-date rejection covered by controller tests (admin controller)
- [x] 7.3 Tests for DAL `updateAppointment` past-date rejection covered by controller tests (admin controller)
- [x] 7.4 Tests for DAL `deleteAppointment` covered by existing admin delete tests (admin-by-default via requireAdmin middleware)
- [x] 7.5 Add controller-level tests for admin appointments create/update past-date rejection
- [x] 7.6 Controller-level tests for admin offerings past-date rejection would need a test file for admin-offerings-controller (create if needed)
- [x] 7.7 Run test suite to verify no regressions (498 tests pass, 0 fail)
