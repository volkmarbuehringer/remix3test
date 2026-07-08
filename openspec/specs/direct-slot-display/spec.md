## ADDED Requirements

### Requirement: Agent directly shows slots after resource recommendation

After recommending a resource, the customer agent SHALL immediately call `find_next_available_slots` with the recommended resource's ID, without asking the customer for permission.

#### Scenario: Agent recommends resource and directly retrieves slots
- **WHEN** the agent calls `search_resources_by_capability` and finds matching resources
- **AND** the agent recommends the best matching resource to the customer
- **THEN** the agent SHALL call `find_next_available_slots` with the recommended resource's ID and a suitable title
- **AND** the agent SHALL NOT ask the customer "Möchten Sie verfügbare Termine sehen?"
- **AND** the agent SHALL present the available slots to the customer

#### Scenario: Customer directly asks for booking without resource selected
- **WHEN** the customer asks to book or check availability without specifying a resource
- **AND** a resource has been previously recommended in the conversation
- **THEN** the agent SHALL call `find_next_available_slots` with the previously recommended resource's ID
- **AND** the agent SHALL NOT ask the customer "Möchten Sie verfügbare Termine sehen?"

### Requirement: Tool returns up to 9 slots

`find_next_available_slots` SHALL return up to 9 slots (instead of 3) to support the day-grouped display.

#### Scenario: Tool returns up to 9 slots
- **WHEN** `find_next_available_slots` executes and finds more than 9 available slots
- **THEN** the tool SHALL return the first 9 slots ordered by date then start time
- **AND** the response schema SHALL remain unchanged (same fields: slots array with date_epoch_ms, date_display, start_min, end_min)

#### Scenario: Fewer than 9 slots available
- **WHEN** `find_next_available_slots` executes and finds fewer than 9 slots
- **THEN** the tool SHALL return all available slots

### Requirement: Booking form displays slots grouped by day

The booking form SHALL group available slots by day. Each day SHALL be displayed as a visual group header with the date and day name, followed by the timeslots for that day as radio options.

#### Scenario: Booking form renders slots in day groups
- **WHEN** pendingBooking contains slots from multiple days
- **THEN** the booking form SHALL render day headers (e.g., "Mo, 10.06.")
- **AND** under each day header, the corresponding timeslot radio buttons SHALL be listed
- **AND** each radio button SHALL show the time range (e.g., "10:00–11:00 Uhr")

#### Scenario: Booking form with single day
- **WHEN** pendingBooking contains slots from a single day only
- **THEN** the booking form SHALL render a single day header
- **AND** all timeslot radio buttons SHALL be shown under that day

#### Scenario: Each radio button has correct value
- **WHEN** a timeslot radio button is rendered
- **THEN** its value SHALL be `{date_epoch_ms}:{start_min}` (same format as before)
- **AND** it SHALL have `required` attribute
