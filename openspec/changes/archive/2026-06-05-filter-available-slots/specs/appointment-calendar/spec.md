## ADDED Requirements

### Requirement: Inaccessible slots are visually disabled

The system SHALL NOT offer slots that overlap with existing appointments as click-to-create targets in the weekly grid view. Slots occupied by existing appointments SHALL appear as non-interactive grid cells.

#### Scenario: Booked slot not clickable

- **WHEN** a user views the grid
- **AND** a 15-minute slot on a given day overlaps with an existing appointment on that day
- **THEN** that slot SHALL NOT respond to click for creating a new draft appointment

#### Scenario: Booked slot appears as non-bookable

- **WHEN** a slot is not clickable due to overlapping an existing appointment
- **THEN** the slot SHALL render with cursor: default (not pointer)
- **AND** the slot SHALL NOT fire the `startDraft` handler

#### Scenario: Free slot remains clickable

- **WHEN** a slot on a given day does NOT overlap any existing appointment
- **THEN** the slot SHALL remain clickable and create a draft appointment as normal

### Requirement: Self-exclusion during edit

When a user is editing or resizing an existing appointment, that appointment's own time range SHALL be excluded from the "booked" set so the current slot remains available.

#### Scenario: Own appointment does not block its own slot

- **WHEN** a user owns an appointment block occupying minutes 540–600 on Monday
- **AND** the grid renders
- **THEN** the minutes 540–600 SHALL still be clickable for creating new appointments (e.g., a second appointment in the same slot)
- **AND** the appointment block SHALL NOT cause its own underlying grid slots to be marked as non-bookable

### Requirement: 15-minute slot overlap check

The system SHALL consider a 15-minute grid slot at minute `m` as booked when any existing appointment on the same day overlaps it.

#### Scenario: Partial overlap blocks slot

- **GIVEN** an appointment occupies minutes 600–690 (10:00–11:30)
- **WHEN** the grid checks slot minute 660 (11:00)
- **THEN** slot 660 SHALL be non-clickable because 660 < 690 AND 660 + 15 > 600

#### Scenario: Adjacent non-overlapping slot remains free

- **GIVEN** an appointment occupies minutes 600–660 (10:00–11:00)
- **WHEN** the grid checks slot minute 660 (11:00)
- **THEN** slot 660 SHALL remain clickable because 660 < 660 is false (upper bound exclusive)
