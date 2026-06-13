## ADDED Requirements

### Requirement: Admin grids SHALL NOT display internal ID columns

Each interactive admin grid under `/verwaltung` SHALL omit the internal `id` column from the rendered table while continuing to fetch IDs in the underlying query for row identity operations.

Affected grids:
- Offerings (`/verwaltung/offerings`)
- Appointments (`/verwaltung/appointments`)
- Resources (`/verwaltung/resources`)
- Offering Configs (`/verwaltung/offering-configs`)

#### Scenario: Offerings grid hides id column
- **WHEN** an admin views `/verwaltung/offerings`
- **THEN** the table SHALL NOT display a column with the header "ID"
- **AND** the table SHALL still render all remaining columns (KW, WD, Tag, Ressource, Beschreibung, Zeitraum, Aktualisiert)

#### Scenario: Appointments grid hides id column
- **WHEN** an admin views `/verwaltung/appointments`
- **THEN** the table SHALL NOT display a column with the header "ID"
- **AND** the table SHALL still render all remaining columns (Titel, E-Mail, Ressource, Beschreibung, Datum, Zeit, Aktualisiert)

#### Scenario: Resources grid hides id column
- **WHEN** an admin views `/verwaltung/resources`
- **THEN** the table SHALL NOT display a column with the header "ID"
- **AND** the table SHALL still render all remaining columns (Name, Beschreibung, Erstellt, Aktualisiert, Actions)

#### Scenario: Offering Configs grid hides id column
- **WHEN** an admin views `/verwaltung/offering-configs`
- **THEN** the table SHALL NOT display a column with the header "ID"
- **AND** the table SHALL still render all remaining columns (Ressource, Beschreibung, Regeln, Aktualisiert)

### Requirement: Missing form validation SHALL be added

Endpoints that accept user input without schema validation SHALL use `s.parseSafe` with an appropriate schema following the established pattern in the codebase.

Affected endpoints:
- Offerings config save (POST `/verwaltung/offerings/config`)
- Week generation (POST `/verwaltung/offerings/week`)
- User export (POST `/verwaltung/users-export`)

#### Scenario: Offerings config validates resource_id
- **WHEN** an admin submits the offerings config form with an invalid `resource_id`
- **THEN** the system SHALL return a field-level validation error for `resource_id`
- **AND** the form SHALL NOT be submitted

#### Scenario: Week generation validates year and week
- **WHEN** an admin submits the week generation form with missing or non-integer `year` or `week`
- **THEN** the system SHALL return a field-level validation error
- **AND** the form SHALL NOT generate offerings

#### Scenario: User export validates date range
- **WHEN** an admin submits the user export form with invalid or missing `startDate` or `endDate`
- **THEN** the system SHALL return a field-level validation error
- **AND** the export SHALL NOT be generated
