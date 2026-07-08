## Why

After a customer books a single appointment through the chat form, the form disappears entirely. If they want to book a second appointment (e.g., next week, same resource), they must type a new message to the agent, wait for it to re-search slots, and go through the full flow again. This is friction for the common case of booking multiple appointments in one session.

The customer explicitly said: *"the booking form should not close after booking one appointment, to make booking of further appointments possible"* — and if they're done, the Cancel link already handles closing.

## What Changes

**Controller (`controller.tsx`):** On successful booking, instead of clearing `pendingBooking` entirely, remove only the just-booked slot from the available slots array. If slots remain, re-save `pendingBooking` to session so the form persists. If no slots remain, clear it (form disappears naturally — all done).

That's it. No UI changes, no agent prompt changes, no new routes.

## Capabilities

### New Capabilities
- `multi-booking-session`: The customer booking form stays open after a successful booking, showing only the remaining unbooked slots. The customer can chain-book until they cancel or all slots are consumed.

### Modified Capabilities
- (none — the `customer-agent-booking-form` capability already exists; this extends its post-booking behavior)

## Impact

- `app/actions/chat/controller.tsx` — ~5 lines changed in the `confirm_booking` handler (the `if (bookingSucceeded)` branch)
- No schema, no DB, no UI component changes
