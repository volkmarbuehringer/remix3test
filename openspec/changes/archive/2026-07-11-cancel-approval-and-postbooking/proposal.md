## Why

Booking cancellations have no human-in-the-loop gate — `cancelBooking` and `cancelAllAppointments` fire immediately when the agent calls them, relying only on agent instructions for safety. After booking, the customer is dropped back to the chat with no clear exit or continuation path. Both are gaps in the customer agent's interaction model.

## What Changes

- `cancelBooking` tool gains `requireApproval: true` — customer sees a confirmation card before the cancel runs
- `cancelAllAppointments` tool gains `requireApproval: true` — confirmation card shows appointment count before mass cancel
- After a successful booking, a post-booking card appears with "Fertig" (redirect to home) and "Noch einen Termin" (stay in thread, agent continues) options
- Agent instructions updated to reflect tool-level approval replaces chat-level double-check for cancellation

## Capabilities

### New Capabilities

- `cancel-tool-approval`: Adds `requireApproval: true` to `cancelBooking` and `cancelAllAppointments` so every destructive cancel action requires explicit UI confirmation
- `post-booking-routing`: After a booking succeeds, presents a routing decision card so the customer can either finish or continue booking another appointment in the same thread

### Modified Capabilities

- (none — no existing capability specs have requirement changes)

## Impact

- `app/actions/mastra/tools/customer-tools.ts` — add `requireApproval` and `appointmentSummary` param to cancel tools
- `app/actions/chat/controller.tsx` — detect booking success and render routing card; handle re-suspension for cancellation approval
- `app/ui/customer-chat-page.tsx` — add post-booking routing card UI component; add cancellation approval card variant
- `app/actions/mastra/agents/customer-agent.ts` — simplify cancellation instructions (remove chat double-check)
