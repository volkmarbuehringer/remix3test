## Purpose

Form validation for the Nutzer admin page that preserves submitted field values on validation failure, using the `parseSafe` + `context.render()` pattern established at `/client`.

## Requirements

### Requirement: Nutzer name field requires minimum 8 characters

The system SHALL validate that the `name` field in the nutzer create and update forms contains at least 8 characters using a `minLength(8)` schema constraint via `parseSafe`.

#### Scenario: Nutzer create with short name fails validation

- **WHEN** admin submits the nutzer create form with name "Bob" (less than 8 characters)
- **THEN** `parseSafe` SHALL return `{ success: false }` with an issue for the `name` field

#### Scenario: Nutzer update with short name fails validation

- **WHEN** admin submits the nutzer update form with name "Al" (less than 8 characters)
- **THEN** `parseSafe` SHALL return `{ success: false }` with an issue for the `name` field

### Requirement: Nutzer email field requires valid email format

The system SHALL validate that the `email` field in the nutzer forms matches a valid email pattern using an `email()` schema constraint via `parseSafe`.

#### Scenario: Invalid email on nutzer create fails validation

- **WHEN** admin submits the nutzer create form with email "not-an-email"
- **THEN** `parseSafe` SHALL return `{ success: false }` with an issue for the `email` field

### Requirement: Validation failure re-renders nutzer page

The system SHALL, on `parseSafe` validation failure in the nutzer `update` or `create` actions, return a 400 HTML response using `context.render()` that renders the full Nutzer page with the form re-displayed, showing:

- `fieldErrors`: a record mapping field names to their first error message
- `formValues`: the raw submitted string values for each field
- The edit or create panel visible with the error context

#### Scenario: Nutzer create with short name re-renders with error and preserved values

- **WHEN** admin submits the nutzer create form with name "Bob", email "bob@test.com", login "bob"
- **THEN** system SHALL return status 400 with the Nutzer page re-rendered
- **AND** the create panel SHALL be visible
- **AND** the name input SHALL have `value="Bob"`
- **AND** the email input SHALL have `value="bob@test.com"`
- **AND** the login input SHALL have `value="bob"`
- **AND** an error message SHALL be displayed next to the name field

#### Scenario: Nutzer update with invalid email re-renders with error and preserved values

- **WHEN** admin submits the nutzer update form with email "bad-email"
- **THEN** system SHALL return status 400 with the Nutzer page re-rendered
- **AND** the edit panel SHALL be visible
- **AND** the email input SHALL have `value="bad-email"`
- **AND** the other fields SHALL preserve their submitted values
- **AND** an error message SHALL be displayed next to the email field

#### Scenario: Successful validation proceeds with database mutation

- **WHEN** admin submits the nutzer create form with all valid fields
- **THEN** `parseSafe` SHALL return `{ success: true }`
- **AND** the system SHALL create the user in the database
- **AND** redirect to `/nutzer?editing=<newId>`

### Requirement: Nutzer form inputs render error styling on validation failure

The system SHALL render input fields with visual error indicators when the corresponding `fieldErrors` entry exists, matching the `/client` form error styling.

#### Scenario: Nutzer name field shows error state

- **WHEN** `fieldErrors.name` is set to an error message
- **THEN** the name input SHALL be rendered with an error border color
- **AND** the error message text SHALL be displayed adjacent to the input

#### Scenario: Nutzer email field shows error state

- **WHEN** `fieldErrors.email` is set to an error message
- **THEN** the email input SHALL be rendered with an error border color
- **AND** the error message text SHALL be displayed adjacent to the input

### Requirement: Nutzer form checkboxes preserve state on validation failure

The system SHALL preserve checkbox state when re-rendering the form after validation failure.

#### Scenario: Checked checkbox stays checked on validation failure

- **WHEN** admin submits the nutzer create form with "aktiv" checkbox checked and name "Bob" (too short)
- **THEN** the re-rendered form SHALL show the "aktiv" checkbox as checked
- **AND** the "gesperrt" checkbox SHALL show its submitted state
