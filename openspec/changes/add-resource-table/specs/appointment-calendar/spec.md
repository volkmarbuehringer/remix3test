## ADDED Requirements

### Requirement: resource_id on appointment blocks

The AppointmentLayoutBlock interface SHALL include `resource_id` as a required field.

#### Scenario: Block has resource_id

- **WHEN** the grid renders appointments
- **THEN** each appointment block SHALL include the `resource_id` value from the database

### Requirement: Create appointment with resource

The system SHALL require `resource_id` when creating appointments.

#### Scenario: Create with resource_id

- **WHEN** a user creates an appointment with a valid `resource_id`
- **THEN** the appointment SHALL be stored with that `resource_id`
- **THEN** the overlap exclusion constraint SHALL be scoped to that resource

### Requirement: Filter by resource

The system SHALL allow filtering the weekly appointment list by `resource_id`.

#### Scenario: Filtered by resource

- **WHEN** a user selects a resource from the dropdown
- **THEN** the appointment list query SHALL include `WHERE resource_id = :selectedId`

#### Scenario: All resources

- **WHEN** no resource is selected (or "All" is chosen)
- **THEN** the appointment list query SHALL NOT filter by `resource_id`

## MODIFIED Requirements

### Requirement: Overlap prevention

The system SHALL prevent overlapping appointments at the database level using a PostgreSQL exclusion constraint on the `during` range column, scoped per resource.

#### Scenario: Constraint on table

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL have a `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (resource_id WITH =, date WITH =, during WITH &&)` preventing overlapping ranges on the same day for the same resource

#### Scenario: Overlapping insert rejected (same resource)

- **WHEN** an INSERT or UPDATE would create an appointment whose `during` range overlaps with an existing row for the same resource on the same date
- **THEN** PostgreSQL SHALL reject the write with an exclusion constraint violation error

#### Scenario: Overlapping insert allowed (different resource)

- **WHEN** an INSERT or UPDATE creates an appointment whose `during` range overlaps with an existing row but for a different resource
- **THEN** the write SHALL succeed

#### Scenario: Non-overlapping insert succeeds

- **WHEN** an INSERT or UPDATE creates an appointment whose `during` range does NOT overlap any existing row for the same resource on the same date
- **THEN** the write SHALL succeed

### Requirement: Appointments table

The system SHALL store appointments in an `appointments` PostgreSQL table.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL exist with columns: `id` (integer PK), `user_id` (FK → users), `resource_id` (integer, NOT NULL, FK → resources), `title` (text, required), `date` (bigint, required), `created_at` (bigint), `updated_at` (bigint), `during` (int4range, required), `start_min` (integer, GENERATED ALWAYS AS lower(during) STORED), `end_min` (integer, GENERATED ALWAYS AS upper(during) STORED)

#### Scenario: New appointment created

- **WHEN** a user creates an appointment
- **THEN** it SHALL be stored with `during` derived from the provided `start_min` and `end_min` values
- **THEN** the provided `resource_id` SHALL be stored
- **THEN** `created_at` and `updated_at` SHALL be set to the current time

#### Scenario: Appointment updated

- **WHEN** a user updates an appointment
- **THEN** `updated_at` SHALL be updated to the current time
- **THEN** if `start_min` or `end_min` is provided, `during` SHALL be recomputed from the new values
- **THEN** if `resource_id` is provided, it SHALL be updated (if omitted, it SHALL remain unchanged)

### Requirement: Navigation

The system SHALL provide navigation to the appointment calendar from the main app navigation.

#### Scenario: Sidebar nav links

- **WHEN** a user views the appointment sidebar
- **THEN** a resource dropdown, year dropdown, week dropdown, prev/next week buttons, date range display, and navigation links to Home, Lists, AI, and Logout SHALL be shown
