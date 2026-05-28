## MODIFIED Requirements

### Requirement: Weekly grid view

The system SHALL display a 7-column weekly grid showing appointments for each day of the selected week.

#### Scenario: Grid columns

- **WHEN** the grid renders
- **THEN** it SHALL show 7 columns labeled Mon through Sun with dates

#### Scenario: Time slots

- **WHEN** the grid renders
- **THEN** each day column SHALL show time slots from midnight to midnight in configurable intervals

#### Scenario: Appointment blocks

- **WHEN** the grid renders appointments
- **THEN** each appointment SHALL appear as a positioned block spanning its time range in the correct day column
- **THEN** blocks for appointments belonging to OTHER users SHALL use a visually distinct style (muted background, ownership accent)

#### Scenario: Empty week

- **WHEN** no appointments exist for the selected week
- **THEN** the grid SHALL display the empty grid with a placeholder message

### Requirement: Update appointment

The system SHALL allow users to update their own appointments only. Foreign appointments SHALL NOT be updatable.

#### Scenario: Drag to move (own)

- **WHEN** a user drags their own appointment block to a different day or time
- **THEN** the block SHALL move to the new position and SHALL be saved to the server

#### Scenario: Drag ignored (foreign)

- **WHEN** a user attempts to drag a foreign appointment block
- **THEN** no drag operation SHALL start
- **THEN** the block SHALL remain in place

#### Scenario: Resize duration (own)

- **WHEN** a user drags the top or bottom edge of their own appointment block
- **THEN** the block SHALL resize and SHALL be saved to the server

#### Scenario: Resize ignored (foreign)

- **WHEN** a user attempts to drag the edge of a foreign appointment block
- **THEN** no resize operation SHALL start

#### Scenario: Inline rename (own)

- **WHEN** a user double-clicks their own appointment title
- **THEN** the title SHALL become editable and SHALL be saved on Enter or blur

#### Scenario: Inline rename ignored (foreign)

- **WHEN** a user double-clicks a foreign appointment title
- **THEN** no edit mode SHALL be entered

#### Scenario: Conflict resolution — foreign blocks are fixed obstacles

- **WHEN** dragging or resizing a user's own appointment would overlap another block
- **THEN** the layout SHALL resolve the overlap by shifting the user's own blocks only
- **THEN** foreign appointment blocks SHALL be treated as fixed obstacles — the layout solver SHALL NOT shift them
- **THEN** if the proposed placement would overlap a foreign block, the solver SHALL return `unresolved: true` and the block SHALL snap back
- **AND** the database exclusion constraint (`date WITH =, during WITH &&`) enforces this globally at the server level

### Requirement: Delete appointment

The system SHALL allow users to delete their own appointments only. Foreign appointments SHALL NOT be deletable.

#### Scenario: Delete via drag to trash (own)

- **WHEN** a user drags their own appointment block to the trashcan zone
- **THEN** the appointment SHALL be deleted from the server and removed from the grid

#### Scenario: Delete ignored (foreign)

- **WHEN** a user attempts to drag a foreign appointment block
- **THEN** no drag operation SHALL start, so the block cannot be moved to the trashcan

### Requirement: Create type from appointment

The system SHALL allow users to create a new appointment type by dragging their own appointment block onto the types panel.

#### Scenario: Drag onto types panel (own)

- **WHEN** a user drags their own appointment block over the types panel
- **THEN** the types panel SHALL show a visual drop zone highlight

#### Scenario: Drop creates type (own)

- **WHEN** a user drops their own appointment block onto the types panel
- **THEN** the system SHALL POST the appointment title to `/appointment/types`
- **THEN** a new type SHALL be created with that title

#### Scenario: Appointment stays unchanged

- **WHEN** a user drops their own appointment block onto the types panel
- **THEN** the appointment SHALL remain in its original position (copy, not move)

#### Scenario: Drop outside types panel cancels

- **WHEN** a user releases the pointer outside the types panel
- **THEN** no type SHALL be created
- **THEN** the existing move/resize behavior SHALL apply as normal

#### Scenario: Foreign appointment drag prevented

- **WHEN** a user attempts to drag a foreign appointment block
- **THEN** the drag SHALL NOT start, so the block cannot be dropped on the types panel
