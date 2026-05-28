## MODIFIED Requirements

### Requirement: Update appointment

The system SHALL allow users to update appointments, provided their own appointments are updated no fewer than 24 hours before the scheduled start time. Admin users MAY update any appointment regardless of time or ownership.

#### Scenario: Drag to move

- **WHEN** a user drags an appointment block to a different day or time
- **THEN** the block SHALL move to the new position and SHALL be saved to the server

#### Scenario: Resize duration

- **WHEN** a user drags the top or bottom edge of an appointment block
- **THEN** the block SHALL resize and SHALL be saved to the server

#### Scenario: Inline rename

- **WHEN** a user double-clicks an appointment title
- **THEN** the title SHALL become editable and SHALL be saved on Enter or blur

#### Scenario: Conflict resolution

- **WHEN** dragging or resizing would overlap another block
- **THEN** the layout SHALL resolve the overlap by shifting blocks

#### Scenario: Update blocked within 24h of start

- **WHEN** a non-admin user attempts to update an appointment
- **AND** the scheduled start time (`date + start_min`) is fewer than 24 hours from the current server time (UTC)
- **THEN** the system SHALL reject the write
- **AND** the system SHALL display error message `"Termine können nur bis 24 Stunden vor Beginn bearbeitet werden."`
- **AND** the appointment SHALL NOT be updated

#### Scenario: Update allowed 24h+ before start

- **WHEN** a non-admin user attempts to update an appointment
- **AND** the scheduled start time is at least 24 hours from the current server time (UTC)
- **THEN** the system SHALL allow the update (subject to other validation rules)

#### Scenario: Admin updates any appointment at any time

- **WHEN** an admin user attempts to update any appointment (own or foreign, any start time)
- **THEN** the system SHALL allow the update (subject to other validation rules)

### Requirement: Delete appointment

The system SHALL allow users to delete appointments. Appointments may be deleted no fewer than 24 hours before the scheduled start time. Admin users MAY delete any appointment regardless of time or ownership.

#### Scenario: Delete via block button

- **WHEN** a user hovers over an appointment block
- **THEN** a delete button SHALL appear on hover

#### Scenario: Confirm delete

- **WHEN** a user clicks the delete button
- **THEN** the appointment SHALL be deleted from the server and removed from the grid

#### Scenario: Delete blocked within 24h of start

- **WHEN** a non-admin user attempts to delete an appointment
- **AND** the scheduled start time (`date + start_min`) is fewer than 24 hours from the current server time (UTC)
- **THEN** the system SHALL reject the deletion
- **AND** the system SHALL display error message `"Termine können nur bis 24 Stunden vor Beginn gelöscht werden."`
- **AND** the appointment SHALL NOT be deleted

#### Scenario: Delete allowed 24h+ before start

- **WHEN** a non-admin user attempts to delete an appointment
- **AND** the scheduled start time is at least 24 hours from the current server time (UTC)
- **THEN** the system SHALL allow the deletion

#### Scenario: Admin deletes any appointment at any time

- **WHEN** an admin user attempts to delete any appointment (own or foreign, any start time)
- **THEN** the system SHALL allow the deletion

### Requirement: Weekly grid view

The system SHALL display a 7-column weekly grid showing appointments for each day of the selected week. When viewed by a non-admin user, blocks belonging to other users SHALL render without title text or hover tooltip.

#### Scenario: Grid columns (unchanged)

- **WHEN** the grid renders
- **THEN** it SHALL show 7 columns labeled Mon through Sun with dates

#### Scenario: Time slots (unchanged)

- **WHEN** the grid renders
- **THEN** each day column SHALL show time slots from midnight to midnight in configurable intervals

#### Scenario: Appointment blocks (unchanged)

- **WHEN** the grid renders appointments
- **THEN** each appointment SHALL appear as a positioned block spanning its time range in the correct day column

#### Scenario: Empty week (unchanged)

- **WHEN** no appointments exist for the selected week
- **THEN** the grid SHALL display the empty grid with a placeholder message

#### Scenario: Foreign block renders without title for non-admin

- **WHEN** a non-admin user views the grid
- **AND** the grid contains appointments belonging to other users
- **THEN** those appointment blocks SHALL render as a colored area without title text
- **AND** those blocks SHALL NOT show a hover tooltip
- **AND** the block SHALL have `cursor: default`

#### Scenario: Foreign block renders with full details for admin

- **WHEN** an admin user views the grid
- **AND** the grid contains appointments belonging to other users
- **THEN** those appointment blocks SHALL render with full title text and details
- **AND** the admin SHALL be able to interact with those blocks (drag, resize, edit, delete)

## ADDED Requirements

### Requirement: Admin can update any appointment via user-facing controller

The system SHALL allow admin users to update appointments belonging to any user through the user-facing API endpoint at `/appointment/:id`.

#### Scenario: Admin PUT /appointment/:id for foreign appointment succeeds

- **WHEN** an admin user sends a PUT request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL update the appointment
- **AND** the response SHALL include the updated appointment data

#### Scenario: Non-admin PUT /appointment/:id for foreign appointment fails

- **WHEN** a non-admin user sends a PUT request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL return a 404 error

### Requirement: Admin can delete any appointment via user-facing controller

The system SHALL allow admin users to delete appointments belonging to any user through the user-facing API endpoint at `/appointment/:id`.

#### Scenario: Admin DELETE /appointment/:id for foreign appointment succeeds

- **WHEN** an admin user sends a DELETE request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL delete the appointment
- **AND** the response SHALL include `{ deleted: true }`

#### Scenario: Non-admin DELETE /appointment/:id for foreign appointment fails

- **WHEN** a non-admin user sends a DELETE request to `/appointment/:id` for an appointment belonging to another user
- **THEN** the system SHALL return a 404 error
