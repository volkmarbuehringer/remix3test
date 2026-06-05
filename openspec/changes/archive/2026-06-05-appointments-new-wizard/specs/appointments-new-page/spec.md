## MODIFIED Requirements

### Requirement: Create form omits user selection

The system SHALL present a 3-step wizard for creating appointments: (1) select resource, (2) select a day with offerings, (3) select a bookable full-hour time and enter title. The authenticated user's ID SHALL be used automatically.

#### Scenario: Create wizard has no user field
- **WHEN** user clicks "Neu"
- **THEN** the wizard begins at step 1 with a resource dropdown
- **WHEN** user completes all 3 steps
- **THEN** the appointment is created
- **THEN** there is no "Benutzer" dropdown

#### Scenario: Create wizard enforces full-hour slots
- **WHEN** user reaches step 3 of the wizard
- **THEN** the time dropdown shows only `start_min` values that are multiples of 60 and fall within at least one offering for the selected resource+day
- **THEN** the end time is always 1 hour after the start time (no end time selection)

### Requirement: Edit form omits user selection and filters time by offerings

The edit form SHALL NOT include a user dropdown. The time dropdown SHALL show only full-hour slots that are bookable for the current resource+date.

#### Scenario: Edit form shows filtered time slots
- **WHEN** user clicks "Bearbeiten" on a row
- **THEN** the edit form panel shows fields: Ressource, Titel, Datum, Startzeit
- **THEN** the Startzeit dropdown contains only `start_min` values that are multiples of 60 and fall within at least one offering for the appointment's resource+date
- **THEN** the currently booked time is always included even if it falls outside current offerings
