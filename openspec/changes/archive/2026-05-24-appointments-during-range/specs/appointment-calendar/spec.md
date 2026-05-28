## ADDED Requirements

### Requirement: Overlap prevention

The system SHALL prevent overlapping appointments at the database level using a PostgreSQL exclusion constraint on the `during` range column.

#### Scenario: Constraint on table

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL have a `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (date WITH =, during WITH &&)` preventing overlapping ranges on the same day (no double booking)

#### Scenario: Overlapping insert rejected

- **WHEN** an INSERT or UPDATE would create an appointment whose `during` range overlaps with an existing row
- **THEN** PostgreSQL SHALL reject the write with an exclusion constraint violation error

#### Scenario: Non-overlapping insert succeeds

- **WHEN** an INSERT or UPDATE creates an appointment whose `during` range does NOT overlap any existing row
- **THEN** the write SHALL succeed

## MODIFIED Requirements

### Requirement: Appointments table

The system SHALL store appointments in an `appointments` PostgreSQL table.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL exist with columns: `id` (integer PK), `user_id` (FK → users), `title` (text, required), `date` (bigint, required), `created_at` (bigint), `updated_at` (bigint), `during` (int4range, required), `start_min` (integer, GENERATED ALWAYS AS lower(during) STORED), `end_min` (integer, GENERATED ALWAYS AS upper(during) STORED)

#### Scenario: New appointment created

- **WHEN** a user creates an appointment
- **THEN** it SHALL be stored with `during` derived from the provided `start_min` and `end_min` values
- **THEN** `created_at` and `updated_at` SHALL be set to the current time

#### Scenario: Appointment updated

- **WHEN** a user updates an appointment
- **THEN** `updated_at` SHALL be updated to the current time
- **THEN** if `start_min` or `end_min` is provided, `during` SHALL be recomputed from the new values

### Requirement: Create appointment from type

The system SHALL allow users to create a new appointment by dragging a type from the types panel onto the calendar grid.

#### Scenario: Drop creates appointment

- **WHEN** a user releases the pointer over a valid time slot
- **THEN** the system SHALL POST to `/appointment` with the `typeId`, `date`, and `start_min`
- **THEN** the server SHALL perform `INSERT INTO appointments(...) SELECT ... FROM appointtypes WHERE id = :typeId AND user_id = :authUserId` using `int4range()`
- **THEN** the page SHALL reload to show the new appointment
