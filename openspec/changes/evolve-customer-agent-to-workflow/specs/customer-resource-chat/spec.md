## ADDED Requirements

### Requirement: Customer agent SHALL find next available appointment slots

The customer agent SHALL have a tool `findNextAvailableSlots` that accepts a `resourceId` (number) and optional `daysAhead` (default 7, max 30). The tool SHALL return the next available full-hour appointment slots for that resource, sorted chronologically, up to 3 results.

The tool SHALL duplicate the slot-finding pipeline from the booking wizard: query `appointoffering` for the date range, query `appointments` for existing bookings, compute full-hour slots within offering ranges, filter out slots overlapping with existing bookings, and filter out past days and past time slots for today.

#### Scenario: Tool returns available slots

- **WHEN** customer agent calls `findNextAvailableSlots` with resourceId=1 and daysAhead=7
- **THEN** the tool queries offerings for resource 1 in the next 7 days
- **AND** the tool queries existing bookings for resource 1 in the same range
- **AND** the tool returns up to 3 sorted slots (date_epoch_ms, date_display, start_min, end_min)

#### Scenario: No available slots

- **WHEN** the resource has no offerings in the next 7 days or all slots are booked
- **THEN** the tool returns an empty array

#### Scenario: Past slots are excluded

- **WHEN** today has offerings but the current time has passed some full-hour slots
- **THEN** only future slots are returned

### Requirement: Customer agent SHALL offer to find slots after recommendation

The customer agent SHALL, after recommending a resource, offer to check available appointment slots. If the customer agrees, the agent SHALL call `findNextAvailableSlots` and present the results.

#### Scenario: Customer asks about availability

- **WHEN** the customer asks "Kann ich da einen Termin machen?"
- **THEN** the agent offers to check available slots for the recommended resource
- **AND** if the customer confirms, calls `findNextAvailableSlots` and presents up to 3 options

#### Scenario: Customer declines slot search

- **WHEN** the customer declines the offer to check slots
- **THEN** the agent responds neutrally and remains available for other questions

## MODIFIED Requirements

### Requirement: Customer agent SHALL be read-only

**FROM:**
The customer agent instructions SHALL explicitly forbid creating, modifying, or deleting any data in the system. The agent SHALL only use the `searchResourcesByCapability` tool (plus `getCurrentDateTime` and `getLocationContext` for context). No appointment booking, user creation, or data mutation tools SHALL be available.

**TO:**
The customer agent instructions SHALL explicitly forbid creating, modifying, or deleting any data in the system. The agent SHALL only use the `searchResourcesByCapability` and `findNextAvailableSlots` tools (plus `getCurrentDateTime` and `getLocationContext` for context). No appointment booking, user creation, or data mutation tools SHALL be available.

#### Scenario: Agent offers slot lookup instead of flat refusal

- **WHEN** customer asks the agent to book an appointment
- **THEN** the agent offers to check available slots for the recommended resource
- **AND** does NOT suggest using the booking wizard page directly (previous behavior)

### Requirement: Customer agent SHALL derive title from conversation

The customer agent SHALL determine an appropriate appointment title from the conversation context when presenting slot options to the user. The title SHALL be passed along with the booking confirmation form data so the booking agent can use it.

#### Scenario: Title derived from problem description

- **WHEN** customer describes "I need a quiet room for therapy"
- **AND** the agent presents slot options
- **THEN** the derived title is "Therapie-Sitzung" or similar context-appropriate value

#### Scenario: Title included in form data

- **WHEN** the inline booking form is rendered
- **THEN** the title from the agent is embedded as a hidden input in the form
