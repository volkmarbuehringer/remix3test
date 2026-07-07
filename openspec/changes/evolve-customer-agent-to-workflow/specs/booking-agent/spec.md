## ADDED Requirements

### Requirement: Booking agent SHALL create appointments via tool

The system SHALL provide a `bookingAgent` Mastra agent that accepts booking requests and creates appointments using a `createAppointment` tool. The agent SHALL be registered in the Mastra orchestrator alongside `customerAgent` and `supportAgent`.

The `createAppointment` tool SHALL:
- Accept `resource_id` (number), `date` (epoch ms), `start_min` (0–1380, multiple of 15), `title` (string, max 200), and `user_id` (number, from auth context)
- Call the existing `createAppointmentRecord` function from the data layer
- Return `{ success: true, id: number, date: number, start_min: number, end_min: number }` on success
- Return `{ error: "collision", message: string }` on exclusion constraint violation
- Return `{ error: "past_date", message: string }` if the date is in the past
- Return `{ error: "invalid_slot", message: string }` if the start_min is invalid

#### Scenario: Successful appointment creation
- **WHEN** booking agent calls `createAppointment` with valid resource_id, date, start_min, title, and user_id
- **THEN** the tool inserts into the `appointments` table via `createAppointmentRecord`
- **AND** returns `{ success: true, id: <new_id>, date, start_min, end_min: start_min + 60 }`

#### Scenario: Slot collision
- **WHEN** booking agent calls `createAppointment` for a slot that overlaps with an existing appointment
- **THEN** the tool catches the exclusion constraint violation
- **AND** returns `{ error: "collision", message: "Dieser Zeitraum ist bereits belegt." }`

#### Scenario: Past date rejected
- **WHEN** booking agent calls `createAppointment` with a date in the past
- **THEN** the tool returns `{ error: "past_date", message: "Der Termin liegt in der Vergangenheit." }`

### Requirement: Booking agent SHALL respond with confirmation or alternative

The booking agent SHALL respond in German with a clear confirmation message on success, or explain the error and suggest alternatives on failure.

#### Scenario: Confirmation on success
- **WHEN** `createAppointment` returns success with id=42, date=1788998400000, start_min=600
- **THEN** the agent responds with "Termin #42 wurde für Donnerstag, 10.07.2026 um 10:00 Uhr gebucht."

#### Scenario: Collision suggests alternative
- **WHEN** `createAppointment` returns collision error
- **THEN** the agent informs the user that the slot is no longer available
- **AND** suggests checking available slots again by returning to the customer agent

### Requirement: Booking agent SHALL use the same thread as customer agent

The booking agent SHALL operate on the same Mastra thread as the preceding customer agent conversation, so the user's context and history are preserved.

#### Scenario: Booking agent has conversation history
- **WHEN** booking agent processes a confirmation request
- **THEN** it has access to the thread's message history from the customer agent phase
- **AND** can reference the resource name and user's needs in its response
