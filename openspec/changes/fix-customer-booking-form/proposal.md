## Why

The customer agent chat (`/chat`) is designed to let users find resources and book appointments through conversation. When the agent calls `find_next_available_slots` and returns available slots, a booking form should render below the chat for one-click booking. Currently the form never appears — the agent responds with text about available slots, but the `pendingBooking` session state isn't being set, so the form component never renders. This breaks the core booking flow.

## What Changes

- Fix the tool-result parsing in the chat controller so that slot data returned by `find_next_available_slots` is correctly detected and saved to the session
- Add a targeted test that exercises the full "agent returns slots → form renders" path with a mock agent that returns real tool results
- Ensure the booking confirmation POST path (`_action=confirm_booking`) validates correctly against the pending session data

## Capabilities

### New Capabilities

- `customer-agent-booking-form`: The customer agent's slot-booking form lifecycle — agent returns slots → controller parses → session saves → form renders → user submits → workflow creates appointment.

### Modified Capabilities

- (none)

## Impact

- `app/actions/chat/controller.tsx` — tool-result detection logic (may need format fix)
- `app/actions/chat/controller.test.ts` — new test for the slot-parsing path
- No schema, DB, or UI component changes — this is a runtime data-flow fix
