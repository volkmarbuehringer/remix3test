## ADDED Requirements

### Requirement: Post-booking routing card shows after successful booking

When a booking succeeds (via `triggerBookingWorkflow`), the system SHALL display a routing card with two options instead of returning to the normal chat input state.

#### Scenario: Booking success triggers routing card

- **WHEN** `triggerBookingWorkflow` returns `{ success: true }`
- **THEN** the controller SHALL set a `postBookingDecision` flag in the session
- **AND** the chat page SHALL render a routing card

#### Scenario: Routing card shows Fertig and Noch einen Termin

- **WHEN** the routing card is rendered
- **THEN** the card SHALL display "✅ Termin #X wurde gebucht" with appointment details
- **AND** the card SHALL show two buttons:
  - **"Fertig"**: primary style, navigates to the home page
  - **"Noch einen Termin"**: secondary style, stays in the chat thread
- **AND** the normal message textarea SHALL NOT be shown while the card is visible

#### Scenario: Fertig redirects to home

- **WHEN** the customer clicks "Fertig"
- **THEN** the system POSTs to clear session state
- **AND** redirects to the home page (`/`)

#### Scenario: Noch einen Termin keeps thread alive

- **WHEN** the customer clicks "Noch einen Termin"
- **THEN** the system clears the `postBookingDecision` flag from the session
- **AND** the chat page re-renders with the normal message input
- **AND** the agent instructs the customer that they can describe another request

#### Scenario: Routing card does not appear for failed bookings

- **WHEN** `triggerBookingWorkflow` returns an error (e.g., `collision`)
- **THEN** the system SHALL show the error message in the chat
- **AND** the routing card SHALL NOT appear
- **AND** the message textarea SHALL remain available

### Requirement: Post-booking routing card extends to legacy form bookings

The routing card SHALL also appear after a booking via the legacy `confirm_booking` form path.

#### Scenario: Legacy form booking also shows routing card

- **WHEN** the legacy form submits and the booking workflow succeeds
- **THEN** the controller SHALL set the `postBookingDecision` flag
- **AND** the routing card SHALL be shown on the next render

### Requirement: Post-booking card is a soft fork

The routing card SHALL NOT be a hard gate — refreshing the page or navigating away SHALL clear the flag without side effects.

#### Scenario: Refresh clears routing card

- **WHEN** the customer has a routing card visible
- **AND** the customer refreshes the page
- **THEN** the `postBookingDecision` flag is consumed on render
- **AND** the normal chat state is restored
- **AND** the booking result text remains in the chat message history
