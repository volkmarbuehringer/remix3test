## ADDED Requirements

### Requirement: Resources table

The system SHALL store resources in a `resources` PostgreSQL table. Resources represent bookable entities (rooms, equipment, staff) that can be assigned to appointments.

#### Scenario: Table auto-created on startup

- **WHEN** the server starts
- **THEN** the `resources` table SHALL exist with columns: `id` (SERIAL PK), `description` (TEXT NOT NULL), `created_at` (BIGINT), `updated_at` (BIGINT)

#### Scenario: Seed initial resource

- **WHEN** the server starts and the `resources` table is empty
- **THEN** the system SHALL insert a resource with description "resource1"

#### Scenario: Resources listed

- **WHEN** a resource list is requested
- **THEN** all resources SHALL be returned ordered by `description` ascending

### Requirement: Resource dropdown

The system SHALL provide a resource dropdown in the appointment sidebar that allows users to filter the calendar view.

#### Scenario: Dropdown in sidebar

- **WHEN** a user views the appointment sidebar
- **THEN** a `select` element labeled "Resource" SHALL appear with options for each resource and a "All" option

#### Scenario: Filter by resource

- **WHEN** a user selects a resource from the dropdown
- **THEN** the calendar grid SHALL only show appointments for that resource

#### Scenario: All resources

- **WHEN** a user selects "All" from the dropdown
- **THEN** the calendar grid SHALL show appointments for all resources (including null resource_id)

#### Scenario: Resource persisted in URL

- **WHEN** a user selects a resource
- **THEN** the `resource_id` SHALL be reflected in the URL query parameter

### Requirement: Resource seed data

The system SHALL seed resources on first startup.

#### Scenario: Single resource seeded

- **WHEN** the server starts and the `resources` table contains no rows
- **THEN** a row with `description` = "resource1" SHALL be inserted
