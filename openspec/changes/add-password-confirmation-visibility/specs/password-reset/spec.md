## MODIFIED Requirements

### Requirement: Password reset endpoint

The system SHALL provide a password reset endpoint at `/auth/forgotten/:token` where users set a new password.

#### Scenario: Valid token renders reset form

- **WHEN** a GET request is made to `/auth/forgotten/:token` with a valid, unexpired token
- **THEN** the system renders a form with a "New password" field (minimum 8 characters) and a submit button
- **AND** the password field includes a visibility toggle button

#### Scenario: Valid token sets new password

- **WHEN** a POST request is made to `/auth/forgotten/:token` with a valid token and a new password of at least 8 characters
- **THEN** the user's `password_hash` is updated with the hashed new password
- **AND** the `password_reset_token` and `password_reset_expires` are cleared to NULL
- **AND** the response redirects to the login page with a success flash message

#### Scenario: Expired token

- **WHEN** a GET or POST request is made to `/auth/forgotten/:token` with a token whose `password_reset_expires` is in the past
- **THEN** the system renders a page with a 400 status showing "This reset link has expired"
- **AND** the page includes a link to request a new reset

#### Scenario: Invalid or unknown token

- **WHEN** a GET or POST request is made to `/auth/forgotten/:token` with a token not matching any user
- **THEN** the system renders a page with a 400 status showing "Invalid reset link"
- **AND** the page includes a link to request a new reset

#### Scenario: Already used token

- **WHEN** a GET or POST request is made to `/auth/forgotten/:token` with a token that has already been used (token is NULL)
- **THEN** the system renders a page with a 400 status showing "Invalid reset link"

#### Scenario: Short password rejected

- **WHEN** a POST request is made to `/auth/forgotten/:token` with a password shorter than 8 characters
- **THEN** the response re-renders the reset form with a validation error

#### Scenario: Password toggle reveals password text

- **WHEN** user clicks the visibility toggle on the new password field
- **THEN** the field text becomes visible and the icon changes to indicate the visible state

#### Scenario: Password toggle hides password text

- **WHEN** user clicks the visibility toggle again while password is visible
- **THEN** the field text becomes hidden and the icon changes to indicate the hidden state
