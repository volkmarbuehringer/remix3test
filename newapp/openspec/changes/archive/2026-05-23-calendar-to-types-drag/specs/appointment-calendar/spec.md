## ADDED Requirements

### Requirement: Create type from appointment

The system SHALL allow users to create a new appointment type by dragging an appointment block onto the types panel.

#### Scenario: Drag onto types panel

- **WHEN** a user drags an appointment block over the types panel
- **THEN** the types panel SHALL show a visual drop zone highlight

#### Scenario: Drop creates type

- **WHEN** a user drops an appointment block onto the types panel
- **THEN** the system SHALL POST the appointment title to `/appointment/types`
- **THEN** a new type SHALL be created with that title

#### Scenario: Appointment stays unchanged

- **WHEN** a user drops an appointment block onto the types panel
- **THEN** the appointment SHALL remain in its original position (copy, not move)

#### Scenario: Drop outside types panel cancels

- **WHEN** a user releases the pointer outside the types panel
- **THEN** no type SHALL be created
- **THEN** the existing move/resize behavior SHALL apply as normal
