## 1. Cancellation tool approval

- [x] 1.1 Add `requireApproval: true` and `appointmentSummary` parameter to `cancelBooking` tool in `customer-tools.ts`
- [x] 1.2 Add `requireApproval: true`, `count`, and `appointmentSummaries` parameters to `cancelAllAppointments` tool in `customer-tools.ts`
- [x] 1.3 Remove the `requireApproval: false` (default) from both cancellation tools

## 2. Controller suspension handling for cancellation

- [x] 2.1 Add an `extractCancelApproval` function that extracts cancellation summary data from `suspendPayload`
- [x] 2.2 Update the `action` handler to detect cancellation suspension (tool name in tool results) and flash appropriate approval data
- [x] 2.3 Update the `approve`/`decline` handlers to render cancellation-themed approval cards (danger styling) when the suspended tool is a cancel tool
- [x] 2.4 Add test coverage for cancellation suspension and approve/decline flows

## 3. Post-booking routing card

- [x] 3.1 After booking success detection in the `action` handler, set a `postBookingDecision` flag in the session
- [x] 3.2 Handle `_action=finish` in the `action` handler: clear session and redirect to home
- [x] 3.3 Handle `_action=continue` in the `action` handler: clear the `postBookingDecision` flag and redirect to chat
- [x] 3.4 Extend the legacy `confirm_booking` form handler to also set the `postBookingDecision` flag on success
- [x] 3.5 Add test coverage for post-booking routing state

## 4. UI: Cancellation approval card

- [x] 4.1 Add a cancellation approval card component to `customer-chat-page.tsx` with danger/warning styling (red border, "Stornierung bestätigen" title)
- [x] 4.2 Show appointment summary text in the cancellation card
- [x] 4.3 Add "Ja, stornieren" and "Nein" buttons wired to `routes.chat.approve` and `routes.chat.decline`
- [x] 4.4 For `cancelAllAppointments`, show count and scrollable list of summaries
- [x] 4.5 Hide the message textarea while a cancellation approval card is visible

## 5. UI: Post-booking routing card

- [x] 5.1 Add a post-booking routing card component to `customer-chat-page.tsx`
- [x] 5.2 Card shows "✅ Termin #X wurde gebucht" with appointment details (date, time, resource)
- [x] 5.3 Add "Fertig" button that POSTs to `chat.action` with `_action=finish`
- [x] 5.4 Add "Noch einen Termin" button that POSTs to `chat.action` with `_action=continue`
- [x] 5.5 Hide the message textarea while the routing card is visible

## 6. Agent instructions

- [x] 6.1 Update `cancelBooking` instruction in `customer-agent.ts` to remove chat-level double-check (replace with "Das System fordert eine Bestätigung an")
- [x] 6.2 Update `cancelAllAppointments` instruction to reflect that the approval card handles final confirmation
