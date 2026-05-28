## ADDED Requirements

### Requirement: Create appointment from type

The system SHALL allow users to create a new appointment by dragging a type from the types panel onto the calendar grid.

#### Scenario: Drag type onto grid

- **WHEN** a user pointer-downs on a type item in the types panel and drags it over the calendar grid
- **THEN** a ghost block SHALL appear at the snapped time slot showing where the appointment will land

#### Scenario: Ghost block shows 60 min

- **WHEN** a type is being dragged over the grid
- **THEN** the ghost block SHALL span 60 minutes from the snapped start time

#### Scenario: Drop creates appointment

- **WHEN** a user releases the pointer over a valid time slot
- **THEN** the system SHALL POST to `/appointment` with the `typeId`, `date`, and `start_min`
- **THEN** the server SHALL perform `INSERT INTO appointments(...) SELECT ... FROM appointtypes WHERE id = :typeId AND user_id = :authUserId`
- **THEN** the page SHALL reload to show the new appointment

#### Scenario: Drop outside grid cancels

- **WHEN** a user releases the pointer outside the grid bounds
- **THEN** no appointment SHALL be created and the ghost block SHALL disappear

#### Scenario: Type from another user rejected

- **WHEN** a typeId references a type belonging to a different user
- **THEN** the INSERT...SELECT SHALL return zero rows and the server SHALL return a 404 error

#### Scenario: Type deleted between drag and drop

- **WHEN** a user starts dragging a type but another session deletes it before the drop
- **THEN** the INSERT...SELECT SHALL return zero rows and the server SHALL return a 404 error
