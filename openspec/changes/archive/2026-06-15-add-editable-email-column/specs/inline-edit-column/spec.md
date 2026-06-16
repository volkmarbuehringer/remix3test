## ADDED Requirements

### Requirement: Inline email editing on client grid
The system SHALL allow users to edit a client's email address by clicking the email cell directly in the table, without navigating to a sidebar form.

#### Scenario: Click email cell to enter edit mode
- **WHEN** user clicks on an email cell in the client grid
- **THEN** the cell content SHALL be replaced with an `<input type="email">` pre-filled with the current email value
- **THEN** the input SHALL receive focus and select all text

#### Scenario: Save on Enter key
- **WHEN** user presses Enter while editing an email cell
- **THEN** the new value SHALL be sent to the server via `PUT /client/:id`
- **THEN** on success, the grid SHALL reload to show the updated value

#### Scenario: Save on blur
- **WHEN** the input loses focus (user clicks elsewhere)
- **THEN** the new value SHALL be sent to the server via `PUT /client/:id`
- **THEN** on success, the grid SHALL reload to show the updated value

#### Scenario: Cancel on Escape
- **WHEN** user presses Escape while editing an email cell
- **THEN** the cell SHALL revert to displaying the original email text without saving

#### Scenario: Cancel on empty value
- **WHEN** user clears the input and blurs or presses Enter
- **THEN** the cell SHALL revert to the original email text without saving (empty is rejected client-side)

#### Scenario: Invalid email on save
- **WHEN** user submits a malformed email
- **THEN** the server SHALL reject with 400
- **THEN** the cell SHALL show an inline error message below the input
- **THEN** the input SHALL remain focused so the user can correct it

#### Scenario: Single clientEntry per page
- **WHEN** multiple rows are rendered
- **THEN** there SHALL be exactly one `clientEntry` component on the page that manages all inline edit behaviors via event delegation

### Requirement: Server accepts partial email update
The `PUT /client/:id` endpoint SHALL accept a JSON body with only the `email` field, without requiring all other fields.

#### Scenario: Partial update with email only
- **WHEN** client sends `PUT /client/:id` with `Content-Type: application/json` and body `{"email": "new@example.com"}`
- **THEN** server SHALL update only the email field for that client
- **THEN** server SHALL return 200 with the updated client

#### Scenario: Email validation on server
- **WHEN** client sends `PUT /client/:id` with an invalid email
- **THEN** server SHALL return 400 with a validation error message
