## ADDED Requirements

### Requirement: Controller detects slot results from agent

When the customer agent returns tool results containing `find_next_available_slots` with non-empty slots, the controller SHALL extract the slot data and save it to the session as `pendingBooking`.

#### Scenario: Agent returns slots in single-step response
- **WHEN** the agent calls `find_next_available_slots` and the tool returns slots in the same `generate()` call
- **THEN** the controller iterates `toolResults`, finds the matching tool by `toolName`, extracts `slots`, `resource_id`, `resource_name`, and `title` from the result
- **THEN** the controller saves `JSON.stringify({ slots, resource_id, resource_name, title })` to `session.pendingBooking`
- **THEN** the controller redirects to `GET /chat?threadId=...`

#### Scenario: Agent returns slots across multi-step response
- **WHEN** the agent calls `search_resources_by_capability` in step 1 and `find_next_available_slots` in step 2 (multi-step)
- **THEN** the controller correctly finds `find_next_available_slots` among all tool results regardless of call order
- **THEN** the slot data is saved to the session

#### Scenario: Agent returns empty slots
- **WHEN** `find_next_available_slots` returns `{ slots: [] }`
- **THEN** the controller does NOT save `pendingBooking` to the session

#### Scenario: Agent makes no tool calls
- **WHEN** the agent responds with text only (no tool calls)
- **THEN** the controller does NOT save `pendingBooking` to the session

### Requirement: Booking form renders when pendingBooking exists

The `CustomerChatPage` SHALL render a booking form when `pendingBooking` prop is provided.

#### Scenario: Form renders with slot options
- **WHEN** `pendingBooking` contains slots
- **THEN** the form renders with a radio button for each slot showing date and time range
- **THEN** the form includes hidden fields for `_action=confirm_booking`, `resource_id`, `title`, and `threadId`

#### Scenario: Form submits and creates appointment
- **WHEN** the user selects a slot and clicks "Termin buchen"
- **THEN** the controller validates the selected slot matches a pending booking slot
- **THEN** the controller runs `bookingWorkflow` to create the appointment
- **THEN** the result is displayed as a message in the chat

#### Scenario: Mismatched slot submission is rejected
- **WHEN** the user submits a slot that doesn't match any pending booking slot
- **THEN** the controller clears the pending booking and redirects with an error
