## Why

The customer chat agent currently asks the user "Möchten Sie verfügbare Termine sehen?" after recommending a resource, adding an unnecessary back-and-forth. Users expect to see available appointments immediately after a resource is suggested, without an extra question. This also adds friction and increases drop-off.

## What Changes

- Agent instructions updated: after recommending a resource, the agent immediately calls `find_next_available_slots` without asking for permission
- `find_next_available_slots` tool returns more slots (up to 9, grouped by day) to show multiple days with their respective timeslots
- Slot display in the booking form is restructured into a 2-tier layout: first the available days, then under each day the available timeslots
- The booking form radio selection changes from flat list to day-grouped layout

## Capabilities

### New Capabilities

- `direct-slot-display`: After resource recommendation, the agent directly retrieves and displays available appointment slots without asking the customer for permission. Slots are shown in a 2-tier layout: available days first, then timeslots per day.

### Modified Capabilities

- (none)

## Impact

- `app/actions/mastra/agents/customer-agent.ts`: Agent instructions updated — remove the "ask for permission" step
- `app/actions/mastra/tools/customer-tools.ts`: `find_next_available_slots` returns more slots grouped by day
- `app/ui/customer-chat-page.tsx`: Booking form radio list restructured into day-grouped layout
- `app/actions/chat/controller.test.ts`: Tests need updating for the new agent behavior and slot volume
- `app/actions/chat/controller.tsx`: May need minor adjustments for the tool result processing
