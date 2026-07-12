## 1. Client-Side: Add buttons to slot picker

- [x] 1.1 Add "Andere Ressource" and "Schließen" buttons to the slot picker HTML template in `appendSlotPicker()`, below the pagination controls with a divider
- [x] 1.2 Add `handleSlotCancel()` function that removes the slot picker DOM element and re-enables the chat input (for "Schließen" button)
- [x] 1.3 Add `handleOtherResource()` function that appends "Ich möchte eine andere Ressource ausprobieren." as a user bubble and sends POST /chat with the message (for "Andere Ressource" button)
- [x] 1.4 Wire both click handlers into the chat-area click delegation in `ref()` callback
- [x] 1.5 Verify existing slot click and pagination still work after changes

## 2. Agent: Add "other resource" instruction

- [x] 2.1 Add instruction line to `customer-agent.ts` telling the agent to re-search with the same query terms when the user requests a different resource during slot display
