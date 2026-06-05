# Password Reset

## Purpose

Allow users who forget their password to reset it securely via email. The user enters their email on a forgot-password form, receives a time-limited reset link via email, and sets a new password.

## Requirements

### Requirement: Forgot password form

The system SHALL provide a forgot-password form at `/auth/forgotten` where users can enter their email address to request a password reset.

#### Scenario: Forgot password page renders

- **WHEN** a GET request is made to `/auth/forgotten`
- **THEN** the system renders a page with an email input field and a submit button labeled "Send reset link"
- **AND** the page includes a link back to the login page

#### Scenario: Forgot password submission with existing email

- **WHEN** a POST request is made to `/auth/forgotten` with a valid email that matches a registered user
- **THEN** a password reset token is generated and stored on the user record with a 1-hour expiry
- **AND** a password reset email is sent to the user's email address
- **AND** the response renders a success page: "If an account with that email exists, we've sent a password reset link."

#### Scenario: Forgot password submission with non-existing email

- **WHEN** a POST request is made to `/auth/forgotten` with an email not matching any registered user
- **THEN** no token is generated and no email is sent
- **AND** the response renders the same success page as a valid submission (no user enumeration)

#### Scenario: Forgot password submission with invalid email format

- **WHEN** a POST request is made to `/auth/forgotten` with an invalid email format
- **THEN** the response re-renders the form with a validation error

### Requirement: Password reset token generation

The system SHALL generate a cryptographically random token for password reset and store it on the user record with an expiry timestamp.

#### Scenario: Token generated on forgot-password request

- **WHEN** a password reset is requested for an existing user
- **THEN** a random token (at least 32 bytes, base64url-encoded) is generated via `crypto.getRandomValues()`
- **AND** the token is stored in the `password_reset_token` column
- **AND** the `password_reset_expires` is set to `Date.now() + 3600000` (1 hour)

#### Scenario: Token overwritten on subsequent requests

- **WHEN** a password reset is requested for a user who already has an unexpired reset token
- **THEN** a new token is generated, overwriting the previous one
- **AND** the new expiry is set to 1 hour from now

### Requirement: Password reset email delivery

The system SHALL send a password reset email containing a link to the reset page.

#### Scenario: Reset email content

- **WHEN** a password reset email is composed for user "John" with token "xyz789"
- **THEN** the HTML body contains a greeting addressing "John"
- **AND** the body contains a link to `/auth/forgotten/xyz789`
- **AND** the body mentions the 1-hour expiration
- **AND** the plain text body contains the same information as the HTML body

#### Scenario: Email sending failure is silent

- **WHEN** the SMTP server is unreachable during password reset
- **THEN** the error is logged to the console
- **AND** the success page is still shown to the user (no indication of failure)

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

### Requirement: Rate limiting on forgot-password endpoint

The system SHALL rate-limit the POST `/auth/forgotten` endpoint to prevent abuse.

#### Scenario: Rate limit enforced

- **WHEN** more than 5 requests are made with the same email key within 15 minutes to POST `/auth/forgotten`
- **THEN** subsequent requests receive a 429 response with an error message

### Requirement: Forgot password link on login page

The system SHALL display a "Forgot password?" link on the login page.

#### Scenario: Forgot password link renders

- **WHEN** the login page is rendered
- **THEN** a "Forgot password?" link is displayed below the password input field
- **AND** the link navigates to `/auth/forgotten`
