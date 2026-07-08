## 1. Update Agent Instructions

- [x] 1.1 Remove "ask permission" rule from `customer-agent.ts` — replace with immediate `find_next_available_slots` call after resource recommendation
- [x] 1.2 Update tool description in `customer-tools.ts` to reflect returning up to 9 slots

## 2. Increase Tool Slot Limit

- [x] 2.1 In `customer-tools.ts`, change `allSlots.slice(0, 3)` to `allSlots.slice(0, 9)`

## 3. Restructure Booking Form to Day-Grouped Layout

- [x] 3.1 In `customer-chat-page.tsx`, group `pendingBooking.slots` by `date_epoch_ms` before rendering
- [x] 3.2 Render a day header for each group (reuse `slot.date_display`)
- [x] 3.3 Render timeslot radio buttons indented under each day header
- [x] 3.4 Add CSS for the day-grouped layout (day header style, nested slot list)

## 4. Update Tests

- [x] 4.1 Update the "slot detection from tool results" tests in `controller.test.ts` — mock agents return up to 9 slots across 3 days
- [x] 4.2 Add assertions for day-grouped HTML structure in the booking form
- [x] 4.3 Verify `npm run typecheck` passes
- [x] 4.4 Verify `npm test` passes
