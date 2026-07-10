## ADDED Requirements

### Requirement: Chat UI SHALL render inline booking form for agent slot results

The chat UI (`customer-chat-page.tsx`) SHALL detect when the customer agent response contains structured slot data and render an inline confirmation form below the agent's message text.

The form SHALL contain:

- Radio buttons for each available slot, showing date and time range (e.g., "Do 10.07. 10:00–11:00")
- Hidden inputs for `resource_id`, `title`, and the selected slot's `date` and `start_min`
- A submit button labeled "Termin buchen"
- No more than 3 slot options presented at once

#### Scenario: Form renders below agent message

- **WHEN** the customer agent returns a response with slot data
- **THEN** the agent's text message is displayed normally
- **AND** the inline form is rendered immediately below the message
- **AND** each slot option is shown as a radio button with date and time range

#### Scenario: No slot data, no form

- **WHEN** the customer agent returns a response without slot data
- **THEN** no form is rendered
- **AND** the chat UI behaves as before

#### Scenario: Only one slot available

- **WHEN** only one slot is available
- **THEN** the form shows one radio button (pre-selected)
- **AND** the "Termin buchen" button is visible

### Requirement: Inline form SHALL POST to chat controller with confirm action

The form SHALL POST to `/chat` with `_action=confirm_booking` and the booking parameters as hidden inputs. The controller SHALL route this to the booking agent for processing.

#### Scenario: Form submission routes to booking agent

- **WHEN** user selects a slot and clicks "Termin buchen"
- **THEN** the form POSTs to `/chat` with `_action=confirm_booking`, `resource_id`, `date`, `start_min`, and `title`
- **AND** the controller routes to `bookingAgent.generate()` for processing

#### Scenario: Form preserves thread context

- **WHEN** the form is submitted
- **THEN** the current `threadId` from the URL is included in the form data
- **AND** the booking agent continues the same conversation thread

### Requirement: Form SHALL be disabled after submission

The form SHALL be disabled (submit button grayed out) after the user clicks "Termin buchen" to prevent double-submission while the booking is being processed.

#### Scenario: Button disabled on click

- **WHEN** user clicks "Termin buchen"
- **THEN** the button is immediately disabled and shows a loading state
- **AND** the form cannot be resubmitted
