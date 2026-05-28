## 1. Date Utility — Forward-Looking 24h Check

- [x] 1.1 Add `isWithinHours(epochMs: number, hours: number): boolean` to `app/utils/date-utils.ts`
- [x] 1.2 Keep `isDateInPast()` unchanged for create operations

## 2. DAL — 24h Cancellation Policy for Update/Delete

- [x] 2.1 Add `{ adminBypass?: boolean }` option to `updateAppointment()` in `app/data/appointments.ts`
- [x] 2.2 In `updateAppointment()`: compute `appointmentStartMs = date + start_min * 60000`, reject with `AppointmentTooCloseError` (German) if not within 24h for non-admin
- [x] 2.3 In `deleteAppointment()`: compute `appointmentStartMs = date + start_min * 60000`, reject with `AppointmentPastDeleteError` (German) if not within 24h for non-admin
- [x] 2.4 `createAppointment()` — keep existing `isDateInPast()` check, no change

## 3. User-Facing Controller — Admin Detection and Bypass

- [x] 3.1 Detect admin role from `auth.identity.role` in index/update/destroy actions
- [x] 3.2 Pass `isAdmin` field in the embedded page data from the `index` action
- [x] 3.3 In `update` action: pass `adminBypass: true` to `updateAppointment()` when admin
- [x] 3.4 In `destroy` action: pass `adminBypass: true` to `deleteAppointment()` when admin
- [x] 3.5 Error messages in German: "Termine können nur bis 24 Stunden vor Beginn bearbeitet/gelöscht werden."
- [x] 3.6 TypeId-based create path past-date check stays unchanged

## 4. Admin Controllers — No 24h Changes Needed

- [x] 4.1 Admin controllers bypass past-date checks for delete (raw SQL, no guard)
- [x] 4.2 Admin controller create/update `isDateInPast()` checks remain in place

## 5. Client-Side UI — Foreign Block Privacy and Admin Interaction

- [x] 5.1 Include `isAdmin` boolean in the embedded JSON in `appointment-page.tsx`
- [x] 5.2 Non-admin: hidden title, no hover, no tooltip, no resize on foreign blocks
- [x] 5.3 Admin: full interaction on all blocks regardless of ownership
- [x] 5.4 Delete via drag-to-trashcan works for admin on foreign blocks

## 6. Tests

- [x] 6.1 `isWithinHours()` unit tests (7 test cases: 25h, 23h, already started, exactly 24h, etc.)
- [x] 6.2 Appointment grid test dates shifted to ensure 24h cancellation policy passes
- [x] 6.3 Full test suite: 498 test pass, 0 fail
