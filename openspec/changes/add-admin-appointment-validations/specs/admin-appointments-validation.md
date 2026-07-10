## ADDED Requirements

### Requirement: Admin create validates offering availability

When an admin creates an appointment at `/admin/appointments`, the system SHALL verify that the requested time range (`start_min` to `end_min`) for the given resource and date falls within at least one configured offering in the `appointoffering` table.

#### Scenario: Create succeeds when slot is within offering hours

- **WHEN** an admin creates an appointment with a time range that is fully contained within an existing offering for that resource and date
- **THEN** the appointment SHALL be created successfully

#### Scenario: Create fails when no offering exists for time range

- **WHEN** an admin creates an appointment with a time range that falls outside all offerings for that resource and date
- **THEN** the system SHALL reject the creation with a German error message indicating the time range is outside booking hours

#### Scenario: Create fails when no offerings exist for resource/date

- **WHEN** an admin creates an appointment for a resource/date combination that has no offerings at all
- **THEN** the system SHALL reject the creation with a German error message

### Requirement: Admin update validates offering availability when slot changes

When an admin updates an appointment at `/admin/appointments/:id`, the system SHALL verify the resulting time range (`start_min`, `end_min`, `date`, `resource_id`) is within an offering if any of the slot-related fields have changed.

#### Scenario: Update succeeds when slot remains within offering

- **WHEN** an admin updates an appointment's title (no slot fields changed)
- **THEN** the update SHALL succeed without checking offering availability

#### Scenario: Update succeeds when new slot is within offering

- **WHEN** an admin updates an appointment's date or time to a range that is within an offering
- **THEN** the update SHALL succeed

#### Scenario: Update fails when new slot is outside offering

- **WHEN** an admin updates an appointment's date or time to a range that is outside all offerings
- **THEN** the system SHALL reject the update with a German error message

### Requirement: Admin create/update detects colliding appointments

When an admin creates or updates an appointment, the system SHALL detect overlaps with existing appointments for the same resource and date (via PostgreSQL exclusion constraint).

#### Scenario: Create fails on overlapping time range

- **WHEN** an admin creates an appointment whose time range overlaps with an existing appointment for the same resource and date
- **THEN** the system SHALL reject with a German error message about overlapping time ranges

#### Scenario: Update fails on overlapping time range

- **WHEN** an admin updates an appointment to a time range that overlaps with another existing appointment for the same resource and date
- **THEN** the system SHALL reject with a German error message about overlapping time ranges
