## ADDED Requirements

### Requirement: Name field requires minimum 8 characters

The system SHALL validate that the `name` field in the client form contains at least 8 characters using a `minLength(8)` schema constraint.

#### Scenario: Name too short on create

- **WHEN** user submits the create form with name "Bob" (less than 8 characters)
- **THEN** `parseSafe` returns `{ success: false }` with an issue for the `name` field indicating the minimum length requirement

#### Scenario: Name too short on update

- **WHEN** user submits the update form with name "Al" (less than 8 characters)
- **THEN** `parseSafe` returns `{ success: false }` with an issue for the `name` field

#### Scenario: Name meets minimum length

- **WHEN** user submits the form with name "Jonathan" (8+ characters)
- **THEN** `parseSafe` returns `{ success: true }` with no issues for the `name` field

### Requirement: Validation failure re-renders form page

The system SHALL, on `parseSafe` validation failure in the `update` or `create` actions, return a 400 HTML response using `context.render()` that renders the full Client Lab page with the form re-displayed, showing:

- `fieldErrors`: a record mapping field names to their first error message
- `formValues`: the raw submitted string values for each field
- The edit or create sidebar visible with the error context

#### Scenario: Create with short name re-renders with error and preserved values

- **WHEN** user submits the create form with name "Bob", email "bob@test.com", role "Viewer"
- **THEN** system returns status 400 with the Client Lab page re-rendered
- **AND** the create sidebar is visible
- **AND** the name input has `value="Bob"`
- **AND** the email input has `value="bob@test.com"`
- **AND** an error message is displayed next to the name field indicating the minimum length requirement

#### Scenario: Update with short name re-renders with error and preserved values

- **WHEN** user submits the update form for an existing client with name "Ed"
- **THEN** system returns status 400 with the Client Lab page re-rendered
- **AND** the edit sidebar is visible
- **AND** the name input has `value="Ed"`
- **AND** an error message is displayed next to the name field

### Requirement: Form inputs render error styling on validation failure

The system SHALL render input fields with visual error indicators when the corresponding `fieldErrors` entry exists.

#### Scenario: Name field shows error state

- **WHEN** `fieldErrors.name` is set to an error message
- **THEN** the name input is rendered with an error border or color
- **AND** the error message text is displayed adjacent to the input

### Requirement: Client Lab is accessible from main navigation

The system SHALL include a "Client Lab" link in the main navigation bar pointing to `/client`.

#### Scenario: Authenticated user sees Client Lab link

- **WHEN** an authenticated user loads any page
- **THEN** the main navigation bar contains a link labeled "Client Lab" with href `/client`
- **AND** clicking the link navigates to the Client Lab page
