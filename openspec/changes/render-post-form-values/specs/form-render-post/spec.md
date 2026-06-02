## ADDED Requirements

### Requirement: Form renders at /test-form

The system SHALL serve a form page at `GET /test-form` with fields for name, email, and message. The page SHALL use the standard `Layout` component for consistent navigation.

#### Scenario: User visits the form
- **WHEN** user navigates to `/test-form`
- **THEN** system returns a 200 HTML response containing a form with name, email, and message input fields, a CSRF token, and a submit button

### Requirement: Form validates input server-side

The system SHALL validate submitted form data using `parseSafe` with a schema requiring name (1-100 chars, non-empty), email (valid email format), and message (optional, max 500 chars).

#### Scenario: All fields valid
- **WHEN** user submits the form with valid name, valid email, and optional message
- **THEN** `parseSafe` returns `{ success: true, value: { name, email, message } }`

#### Scenario: Empty name
- **WHEN** user submits the form with an empty name
- **THEN** `parseSafe` returns `{ success: false, issues: [...] }` with an issue for the name field

#### Scenario: Invalid email format
- **WHEN** user submits the form with name "Bob" and email "not-an-email"
- **THEN** `parseSafe` returns `{ success: false, issues: [...] }` with an issue for the email field

#### Scenario: Message exceeds maximum length
- **WHEN** user submits the form with a message longer than 500 characters
- **THEN** `parseSafe` returns `{ success: false, issues: [...] }` with an issue for the message field

### Requirement: Validation failure re-renders form with errors and preserved values

The system SHALL, on validation failure, return a 400 HTML response rendering the form page with:
- `fieldErrors`: a record mapping field names to their first error message
- `formValues`: a record of raw string values submitted for each field
- A form-level error message

Form inputs SHALL render their `value` attribute from `formValues`, preserving what the user typed.

#### Scenario: Submit with invalid email, values preserved
- **WHEN** user submits the form with name "Bob", email "bad-email", and message "Hello"
- **THEN** system returns status 400 with the form re-rendered
- **AND** the name input has `value="Bob"`
- **AND** the email input has `value="bad-email"`
- **AND** the message textarea contains "Hello"
- **AND** an error message is displayed near the email field

#### Scenario: Submit with empty name
- **WHEN** user submits the form with empty name, valid email, no message
- **THEN** system returns status 400
- **AND** the name field error is displayed
- **AND** the email input preserves the submitted value

### Requirement: Successful submission redirects

The system SHALL redirect the user on successful validation and processing.

#### Scenario: Valid form submission
- **WHEN** user submits the form with valid name, valid email, and optional message
- **THEN** system returns a 302 redirect to `/test-form/success` (or back to `/test-form` with a success indicator)
