## 1. Modify Booking Success Handler

- [x] 1.1 In `app/actions/chat/controller.tsx`, change the `bookingSucceeded` branch (lines 259-260) to filter the booked slot from `pending.slots` instead of clearing the entire `pendingBooking`
- [x] 1.2 Re-save updated `pendingBooking` if slots remain; unset if all slots are consumed
- [x] 1.3 Run `npm run typecheck` to verify no type errors

## 2. Test

- [x] 2.1 Add test cases to `app/actions/chat/controller.test.ts`:
  - POST `confirm_booking` → success → GET → `pendingBooking` still present with remaining slots
  - POST `confirm_booking` → success on last slot → GET → no `pendingBooking`
  - POST `confirm_booking` → success → booking another slot → both succeed
- [x] 2.2 Run `npm test` — all existing tests pass

## 3. Manual Verification

- [ ] 3.1 Start dev server, open customer chat
- [ ] 3.2 Chat → agent finds slots → form appears → book one → form stays with remaining slots
- [ ] 3.3 Book another → form shrinks → continue booking
- [ ] 3.4 Book all remaining slots → form disappears
- [ ] 3.5 Cancel link → form disappears at any point
