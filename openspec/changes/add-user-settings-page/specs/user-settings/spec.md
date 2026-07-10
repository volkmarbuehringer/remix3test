## ADDED Requirements

### Requirement: Settings page at /settings

The system SHALL provide a settings page at `/settings` for authenticated users.

#### Scenario: Settings page renders for authenticated user

- **WHEN** an authenticated user navigates to `GET /settings`
- **THEN** the system renders a settings page with a "Password ändern" section
- **AND** the page includes a form with current password, new password, and confirm password fields

#### Scenario: Settings page redirects unauthenticated user

- **WHEN** an unauthenticated user navigates to `GET /settings`
- **THEN** the system redirects to the login page

### Requirement: Password change form

The system SHALL provide a form on the settings page to change the user's password.

#### Scenario: Password change form renders with all fields

- **WHEN** the settings page is rendered
- **THEN** the password change form contains:
  - A "Current password" password input
  - A "New password" password input
  - A "Confirm new password" password input
  - A "Save" submit button
- **AND** the new password fields have visibility toggle buttons

#### Scenario: Successful password change

- **WHEN** a POST request is made to `/settings` with a valid current password and a new password meeting complexity requirements
- **THEN** the user's `password_hash` is updated with the hashed new password
- **AND** the response renders the settings page with a success message

#### Scenario: Wrong current password

- **WHEN** a POST request is made to `/settings` with an incorrect current password
- **THEN** the response re-renders the settings page with an error message "Current password is incorrect"

#### Scenario: Password confirmation mismatch

- **WHEN** a POST request is made to `/settings` where new password and confirm password do not match
- **THEN** the response re-renders the settings page with an inline validation error

### Requirement: Password complexity validation

The system SHALL enforce password complexity rules when setting a new password.

#### Scenario: Password too short

- **WHEN** a user submits a new password shorter than 10 characters
- **THEN** the response re-renders the settings page with a validation error stating the minimum length requirement

#### Scenario: Password missing digit

- **WHEN** a user submits a new password without any digit (0-9)
- **THEN** the response re-renders the settings page with a validation error stating the digit requirement

#### Scenario: Password missing special character

- **WHEN** a user submits a new password without any special character (e.g., !@#$%^&*)
- **THEN** the response re-renders the settings page with a validation error stating the special character requirement

#### Scenario: Client-side validation provides instant feedback

- **WHEN** a user types into the new password field
- **THEN** the client shows real-time feedback about each complexity rule (length, digit, special character)
- **AND** a strength indicator or checklist shows which rules are satisfied

### Requirement: Settings navigation entry

The system SHALL display a settings entry in the main navigation with an icon and tooltip.

#### Scenario: Settings icon renders for authenticated users

- **WHEN** an authenticated user views the main navigation
- **THEN** a settings icon (`Glyph`) with `title="Einstellungen"` is displayed next to the logout button
- **AND** clicking the icon navigates to `/settings`

#### Scenario: Settings icon hidden for unauthenticated users

- **WHEN** an unauthenticated user views the main navigation
- **THEN** no settings icon is displayed
