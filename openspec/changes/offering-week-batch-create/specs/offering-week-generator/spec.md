## ADDED Requirements

### Requirement: Week generation from config

The system SHALL generate a full ISO week of offerings from a resource's config in one action.

#### Scenario: Generate from config

- **WHEN** admin selects a resource, year, and ISO week number and clicks "Erstellen"
- **THEN** the system SHALL read the resource's config, iterate over each day of the selected week, and INSERT into `appointoffering` for each day matching the config rules

#### Scenario: Holiday skipping

- **WHEN** a day in the selected week matches a config rule but is a public holiday (DE, rp)
- **THEN** the system SHALL NOT create an offering for that day
- **THEN** the skipped day SHALL be reported in the preview

#### Scenario: Existing offering skipped

- **WHEN** an offering already exists for a resource+day+during range that matches generation
- **THEN** the system SHALL skip that row (no duplicate, no error)

#### Scenario: No config for resource

- **WHEN** admin selects a resource with no config
- **THEN** the system SHALL show an error message: "Keine Konfiguration für diese Ressource."

#### Scenario: Result feedback

- **WHEN** generation completes
- **THEN** the system SHALL redirect to the offerings grid showing a success/error flash

### Requirement: Preview before generation

The system SHALL show a preview of what will be created before the admin confirms.

#### Scenario: Preview shows generated days

- **WHEN** admin selects resource, year, and week
- **THEN** the sidebar SHALL show a list of days that match the config, with their time ranges and a checkmark or holiday-skip indicator

#### Scenario: Preview updates on selection change

- **WHEN** admin changes the resource or week selector
- **THEN** the preview SHALL update to reflect the new selection

### Requirement: Add Week button

The system SHALL provide an "Add Week" button in the offerings grid toolbar.

#### Scenario: Button exists

- **WHEN** the admin offerings page renders
- **THEN** the toolbar SHALL show a "+ Add Week" button alongside the existing "+ Add New" button

#### Scenario: Click opens form

- **WHEN** admin clicks "+ Add Week"
- **THEN** the sidebar SHALL open with the week generation form (resource, year, week selectors, preview, and create button)

### Requirement: Generation API

The system SHALL accept `POST /admin/offerings/week` to trigger week generation.

#### Scenario: POST with valid data

- **WHEN** admin submits the form to `POST /admin/offerings/week`
- **THEN** the system SHALL generate offerings and redirect to the grid with a success message

#### Scenario: POST with missing data

- **WHEN** admin submits with missing resource_id, year, or week
- **THEN** the system SHALL return an error and SHALL NOT generate any offerings
