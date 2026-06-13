## MODIFIED Requirements

### Requirement: Resources table

The system SHALL store resources in a `resources` PostgreSQL table. Resources represent bookable entities (rooms, equipment, staff) that can be assigned to appointments.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `resources` table SHALL exist with columns: `id` (SERIAL PK), `name` (TEXT NOT NULL), `description` (TEXT NOT NULL), `created_at` (BIGINT), `updated_at` (BIGINT)

#### Scenario: Existing rows get default name

- **WHEN** the migration runs on an existing `resources` table
- **THEN** existing rows SHALL have `name` set to `'Unbenannt'`

#### Scenario: Resources listed

- **WHEN** a resource list is requested
- **THEN** all resources SHALL be returned ordered by `name` ascending

### Requirement: Resource dropdown

The system SHALL provide a resource dropdown in the appointment sidebar that allows users to filter the calendar view.

#### Scenario: Dropdown shows resource name

- **WHEN** a user views the appointment sidebar
- **THEN** a `select` element labeled "Resource" SHALL appear with each resource's `name` as the option label

#### Scenario: Dropdown in offerings/config forms

- **WHEN** a resource select dropdown appears in offerings, appointments, or offering-config forms
- **THEN** each `<option>` SHALL display the resource's `name`

### Requirement: Resource seed data

The system SHALL seed resources on first startup.

#### Scenario: Resources seeded with name

- **WHEN** the server starts and the `resources` table contains no rows
- **THEN** rows with `name` = "Raum 1" and `name` = "Raum 2" SHALL be inserted, each with a matching `description`

## ADDED Requirements

### Requirement: Name field in resource forms

The system SHALL require a `name` field when creating or editing a resource.

#### Scenario: Create resource with name

- **WHEN** an admin creates a new resource via the create panel
- **THEN** the form SHALL include a required `name` input

#### Scenario: Name must be at least 4 characters

- **WHEN** an admin submits a resource create or update form with a `name` shorter than 4 characters
- **THEN** the system SHALL reject the submission and display a validation error

#### Scenario: Name displayed in table

- **WHEN** an admin views the resources table
- **THEN** each row SHALL display the resource's `name` as the primary column
