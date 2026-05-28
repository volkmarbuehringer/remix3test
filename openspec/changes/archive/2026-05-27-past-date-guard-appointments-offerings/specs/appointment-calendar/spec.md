## MODIFIED Requirements

### Requirement: Create appointment

The system SHALL allow users to create new appointments by clicking on an empty time slot, provided the appointment date is not in the past.

#### Scenario: Click empty slot

- **WHEN** a user clicks an empty time slot in the grid
- **THEN** a draft appointment block SHALL appear at that position

#### Scenario: Name the appointment

- **WHEN** a draft block appears
- **THEN** the user SHALL be able to type a title and press Enter to commit

#### Scenario: Save to server

- **WHEN** a user commits a new appointment
- **THEN** the system SHALL POST the new appointment to the server and display it in the grid

#### Scenario: Past date rejected

- **WHEN** a user commits a new appointment on a date before today (UTC)
- **THEN** the system SHALL reject the write
- **AND** the system SHALL display error message `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the appointment SHALL NOT be created

### Requirement: Update appointment

The system SHALL allow users to update appointments, provided the appointment date is not in the past.

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

#### Scenario: Past date rejected

- **WHEN** a user attempts to update an appointment whose `date` is before today (UTC)
- **THEN** the system SHALL reject the write
- **AND** the system SHALL display error message `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the appointment SHALL NOT be updated

### Requirement: Delete appointment

The system SHALL allow users to delete appointments. Past appointments may only be deleted by admins.

#### Scenario: Delete via block button

- **WHEN** a user hovers over an appointment block
- **THEN** a delete button SHALL appear on hover

#### Scenario: Confirm delete

- **WHEN** a user clicks the delete button
- **THEN** the appointment SHALL be deleted from the server and removed from the grid

#### Scenario: Past appointment delete by non-admin rejected

- **WHEN** a non-admin user attempts to delete an appointment whose `date` is before today (UTC)
- **THEN** the system SHALL reject the deletion
- **AND** the system SHALL display error message `"Termine in der Vergangenheit können nur von Administratoren gelöscht werden."`
- **AND** the appointment SHALL NOT be deleted

#### Scenario: Past appointment delete by admin allowed

- **WHEN** an admin user attempts to delete an appointment whose `date` is before today (UTC)
- **THEN** the system SHALL allow the deletion
