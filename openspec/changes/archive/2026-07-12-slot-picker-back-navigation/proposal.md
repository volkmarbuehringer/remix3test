## Why

When the customer agent shows available time slots for a resource, the user has no way to go back — they can only click a slot (committing to booking) or type free text. This breaks the conversational flow: if the user doesn't like the available times, or wants to try a different resource, they must improvise a text message and hope the agent understands.

## What Changes

- Add "Andere Ressource" button to the slot picker that sends a message to the agent, causing it to re-offer remaining resources from the previous search
- Add "Schließen" button to the slot picker that removes it and re-enables the text input (purely client-side)
- Add agent instruction to handle the "other resource" request by re-searching with the same query terms
- No changes to the booking or cancellation workflows themselves

## Capabilities

### New Capabilities
- `slot-picker-back-navigation`: Cancel and back-navigation affordances on the chat slot picker, enabling users to return to resource selection or dismiss the picker without typing

### Modified Capabilities
- *(none — existing specs cover the slot picker rendering and agent booking logic; this adds UI affordance and agent behavior without changing requirements)*

## Impact

- `app/assets/customer-chat-stream.tsx` — add two buttons to the slot picker DOM + click event handlers
- `app/actions/mastra/agents/customer-agent.ts` — add one instruction line for the "other resource" case
