## 1. Server-Side Enforcement in Controller

- [x] 1.1 Add 24h check to `destroy` action in `app/actions/appointments-new/controller.tsx` — fetch appointment row, compute start time, reject if `!isWithinHours(startTime, 24)`
- [x] 1.2 Add 24h check to `update` action in `app/actions/appointments-new/controller.tsx` — fetch appointment row before applying update, compute start time, reject if `!isWithinHours(startTime, 24)`

## 2. UI Hiding of Action Buttons

- [x] 2.1 Add `blocked?: boolean` field to `AppointmentsNewRow` interface and populate it from the controller's data loader based on `isWithinHours`
- [x] 2.2 Update `app/ui/appointments-new-page.tsx` to conditionally hide edit/delete buttons and render a locked indicator for blocked rows
- [x] 2.3 Add CSS/locked glyph styles for the blocked indicator in the action column

## 3. Tests

- [x] 3.1 Add test for `PUT /appointments/new/:id` rejection when appointment starts within 24h
- [x] 3.2 Add test for `DELETE /appointments/new/:id` rejection when appointment starts within 24h
- [x] 3.3 Verify existing tests still pass with the new restriction


## 4. Verification

- [x] 4.1 Run `npm test` — all 33 tests pass
- [x] 4.2 Run `npm run typecheck` — no type errors