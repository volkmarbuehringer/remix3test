## ADDED Requirements

### Requirement: Step 3 excludes booked full-hour slots

The system SHALL filter the step 3 time dropdown to exclude any full-hour slot that overlaps with an existing appointment for the same resource and day. Only slots that are both within an offering AND not occupied by an existing appointment SHALL appear as options.

#### Scenario: Booked slot omitted from dropdown

- **GIVEN** resource 3 has offerings `[480,1080)` on day X
- **AND** an existing appointment occupies `[600,660)` (10:00–11:00) for resource 3 on day X
- **WHEN** user reaches step 3 with resource_id=3 and day=X
- **THEN** the dropdown SHALL contain all full-hour slots from `computeFullHourSlots` EXCEPT start_min=600
- **AND** the dropdown SHALL still include slots 480, 540, 660, 720, 780, 840, 900, 960, 1020

#### Scenario: Multiple bookings block multiple slots

- **GIVEN** an appointment occupies `[600,780)` (10:00–13:00, 3 hours)
- **WHEN** user reaches step 3
- **THEN** slots 600, 660, and 720 SHALL all be excluded from the dropdown

#### Scenario: Self-exclusion for edit mode

- **GIVEN** a user is editing appointment ID=5 which occupies `[600,660)` on day X
- **WHEN** the step 3 slots are computed for editing
- **THEN** slot 600 SHALL remain in the dropdown because the booking query excludes appointment ID=5

#### Scenario: All slots booked shows empty state

- **GIVEN** every full-hour slot within the offering for a given resource+day is occupied by existing appointments
- **WHEN** user reaches step 3
- **THEN** the page SHALL display "Keine verfügbaren Zeitfenster an diesem Tag"
- **AND** the "Anlegen" button SHALL NOT be shown
