## Why

The customer agent at `/chat` can recommend a resource based on capability matching, but hits a dead end after recommendation — it tells the user to manually use the booking form. This forces a context switch and loses the momentum of the conversation. The agent should be able to find available slots and, with user approval, create the appointment within the same chat session.

## What Changes

- Add a `findNextAvailableSlots` tool to the customer agent that computes available full-hour slots for a resource across the next 7 days (reuses the same slot-computation logic as the booking wizard but duplicates it independently)
- Add a new `bookingAgent` Mastra agent with a `createAppointment` tool that creates appointments via the existing data layer
- Add an inline confirmation form to the chat UI: when the customer agent returns available slots, render radio-button options + a "Termin buchen" button that POSTs to the booking agent
- Extend the chat controller to branch on `_action`: `message` → customer agent, `confirm_booking` → booking agent
- The customer agent derives the appointment title from the conversation context (no separate title input)

## Capabilities

### New Capabilities

- `booking-agent`: New Mastra agent with one tool (`createAppointment`) that inserts into the `appointments` table via existing `createAppointmentRecord()`. Agent instructions scope it to appointment creation only. Registered alongside `customerAgent` and `supportAgent` in the Mastra orchestrator.
- `inline-booking-confirmation`: Inline HTML form rendered in the chat UI showing available slot options (radio buttons) with a confirm button. Form POSTs `_action=confirm_booking` to the chat controller.

### Modified Capabilities

- `customer-resource-chat`: The customer agent gains a new tool `findNextAvailableSlots(resourceId, daysAhead=7)` that returns a sorted list of `{ date_epoch_ms, date_display, start_min, end_min }` for the next available full-hour slots. The agent presents up to 3 options to the user.

## Impact

- **New file**: `app/actions/mastra/agents/booking-agent.ts` — agent definition with tool
- **New file**: `app/actions/mastra/tools/booking-tools.ts` — `createAppointment` tool implementation
- **Modified**: `app/actions/mastra/tools/customer-tools.ts` — add `findNextAvailableSlots` tool
- **Modified**: `app/actions/mastra/index.ts` — register `bookingAgent`
- **Modified**: `app/actions/chat/controller.tsx` — branch on `_action` for message vs booking confirmation; wire booking agent for confirm flow
- **Modified**: `app/ui/customer-chat-page.tsx` — render inline confirmation form when agent returns structured slot data
- **No changes** to existing `/appointments/new` wizard, support agent, admin routes, or data layer
