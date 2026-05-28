## ADDED Requirements

### Requirement: Collision handling

The system SHALL handle exclusion constraint violations gracefully when creating or updating appointments.

#### Scenario: Overlapping slot returns 409

- **WHEN** a POST or PUT would create an appointment whose `during` range overlaps with an existing row
- **THEN** the server SHALL return HTTP 409 Conflict with JSON body `{ error: "Time slot already taken.", code: "collision" }`
- **THEN** the client SHALL reload the page to show the current appointment data

#### Scenario: Non-overlapping request succeeds normally

- **WHEN** a POST or PUT creates an appointment whose `during` range does NOT overlap any existing row
- **THEN** the server SHALL return the normal success response (201 for create, 200 for update)

### Requirement: Cross-session sync via SSE

The system SHALL broadcast appointment changes via an SSE channel so that other open sessions stay in sync.

#### Scenario: Appointment SSE channel exists

- **WHEN** the server starts
- **THEN** an SSE channel SHALL exist for appointment invalidation events
- **THEN** the channel SHALL accept an `invalidate` event with no payload

#### Scenario: SSE subscription endpoint

- **WHEN** a client requests the appointment page
- **THEN** the page SHALL subscribe to the appointment SSE channel
- **THEN** the page SHALL reload when an `invalidate` event is received

#### Scenario: Create broadcasts invalidation

- **WHEN** a POST to `/appointment` succeeds
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: Update broadcasts invalidation

- **WHEN** a PUT to `/appointment/:id` succeeds
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: Delete broadcasts invalidation

- **WHEN** a DELETE to `/appointment/:id` succeeds
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: No broadcast on failed write

- **WHEN** a create, update, or delete fails (validation error, not found, collision)
- **THEN** the server SHALL NOT broadcast an `invalidate` event

#### Scenario: Invalidation from other session triggers reload

- **WHEN** a user has the appointment page open and an `invalidate` event is received from another session
- **THEN** the page SHALL reload to show the updated data
- **THEN** the reload SHALL NOT happen if the user is currently dragging a block or editing a title

## MODIFIED Requirements

### Requirement: Create appointment

The system SHALL allow users to create new appointments by clicking on an empty time slot.

#### Scenario: Click empty slot

- **WHEN** a user clicks an empty time slot in the grid
- **THEN** a draft appointment block SHALL appear at that position

#### Scenario: Name the appointment

- **WHEN** a draft block appears
- **THEN** the user SHALL be able to type a title and press Enter to commit

#### Scenario: Save to server

- **WHEN** a user commits a new appointment
- **THEN** the system SHALL POST the new appointment to the server
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel
- **THEN** the new appointment SHALL appear in the grid

### Requirement: Update appointment

The system SHALL allow users to update appointments.

#### Scenario: Drag to move

- **WHEN** a user drags an appointment block to a different day or time
- **THEN** the block SHALL move to the new position and SHALL be saved to the server
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: Resize duration

- **WHEN** a user drags the top or bottom edge of an appointment block
- **THEN** the block SHALL resize and SHALL be saved to the server
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: Inline rename

- **WHEN** a user double-clicks an appointment title
- **THEN** the title SHALL become editable and SHALL be saved on Enter or blur
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel

#### Scenario: Conflict resolution

- **WHEN** dragging or resizing would overlap another block
- **THEN** the layout SHALL resolve the overlap by shifting blocks

### Requirement: Delete appointment

The system SHALL allow users to delete appointments.

#### Scenario: Delete via block button

- **WHEN** a user hovers over an appointment block
- **THEN** a delete button SHALL appear on hover

#### Scenario: Confirm delete

- **WHEN** a user clicks the delete button
- **THEN** the appointment SHALL be deleted from the server
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel
- **THEN** the appointment SHALL be removed from the grid

### Requirement: Create appointment from type

The system SHALL allow users to create a new appointment by dragging a type from the types panel onto the calendar grid.

#### Scenario: Drop creates appointment

- **WHEN** a user releases the pointer over a valid time slot
- **THEN** the system SHALL POST to `/appointment` with the `typeId`, `date`, and `start_min`
- **THEN** the server SHALL perform `INSERT INTO appointments(...) SELECT ... FROM appointtypes WHERE id = :typeId AND user_id = :authUserId` using `int4range()`
- **THEN** the server SHALL broadcast an `invalidate` event on the appointment SSE channel
- **THEN** the page SHALL reload to show the new appointment
