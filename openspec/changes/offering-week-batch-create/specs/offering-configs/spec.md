## ADDED Requirements

### Requirement: Offering config storage

The system SHALL store weekly offering patterns per resource in an `offering_configs` table with a JSONB `rules` column.

#### Scenario: Table exists

- **WHEN** the server starts
- **THEN** the `offering_configs` table SHALL exist with columns: `id` (SERIAL PK), `resource_id` (FK → resources, ON DELETE CASCADE), `rules` (JSONB, NOT NULL, default '{}'), `created_at` (BIGINT), `updated_at` (BIGINT)

#### Scenario: Unique resource constraint

- **WHEN** a config is created for a resource
- **THEN** a second config for the same resource SHALL be rejected (UNIQUE constraint)

#### Scenario: Resource deletion cascades

- **WHEN** a resource is deleted
- **THEN** its offering config SHALL also be deleted (ON DELETE CASCADE)

### Requirement: Config JSONB format

The system SHALL accept weekly rules as a JSONB object keyed by lowercase English day names with `[startMin, endMin]` minute values.

#### Scenario: Valid config saves

- **WHEN** admin submits `{"monday": [540, 1020], "wednesday": [540, 1200]}`
- **THEN** the config SHALL be saved and readable

#### Scenario: Empty config is valid

- **WHEN** admin submits `{}`
- **THEN** the config SHALL be saved (no days configured = no generation possible)

### Requirement: Config editing UI

The system SHALL provide a structured form to edit offering configs per resource.

#### Scenario: Open config form

- **WHEN** admin navigates to `/admin/offerings?config=<resourceId>`
- **THEN** a sidebar panel SHALL open with the config form pre-filled for that resource

#### Scenario: Config form fields

- **WHEN** the config form renders
- **THEN** it SHALL show 7 rows (Monday through Sunday), each with a checkbox, a start time dropdown, and an end time dropdown

#### Scenario: Save config

- **WHEN** admin clicks save on the config form
- **THEN** the config SHALL be stored and the sidebar SHALL close
