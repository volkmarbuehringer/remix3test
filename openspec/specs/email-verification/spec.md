## ADDED Requirements

### Requirement: Registration creates unverified user

The system SHALL create a new user record with `email_verified = false` when a valid registration form is submitted. The user SHALL NOT be automatically logged in.

#### Scenario: Valid registration creates unverified user

- **WHEN** a user submits valid registration data (name, email, password)
- **THEN** a user record is created with `email_verified = false`
- **AND** the session is NOT populated with auth data
- **AND** the response redirects to a "check your email" page instead of the home page

#### Scenario: Admin user bypasses verification

- **WHEN** an admin user is created through seed data or direct DB insert
- **THEN** the `email_verified` field SHALL be set to `true`
- **AND** the admin can log in without email verification

### Requirement: Verification token generation and storage

The system SHALL generate a cryptographically random verification token on user creation and store it alongside an expiration timestamp.

#### Scenario: Token created on registration

- **WHEN** a new user is registered
- **THEN** a random token (at least 32 bytes, base64url-encoded) is generated via `crypto.getRandomValues()`
- **AND** the token is stored in the `verification_token` column
- **AND** a `verification_expires` timestamp is set to now + 24 hours

#### Scenario: Token uniqueness

- **WHEN** tokens are generated for multiple users
- **THEN** each token SHALL be independently random

### Requirement: Verification email delivery

The system SHALL send a confirmation email to the registered email address containing a verification link.

#### Scenario: Email sent after registration

- **WHEN** a new user successfully registers
- **THEN** an email is sent to the user's email address
- **AND** the email contains a link to the verification URL with the token
- **AND** the email includes the user's name in the greeting
- **AND** the email informs the user the link expires in 24 hours

#### Scenario: Email sending failure does not block registration

- **WHEN** the SMTP server is unreachable during registration
- **THEN** the error is logged to the console
- **AND** the registration still succeeds (user is created, verification page is shown)
- **AND** the user is NOT blocked from later verification

### Requirement: Verification endpoint

The system SHALL provide a verification endpoint that validates a token and marks the user as verified.

#### Scenario: Valid token marks user as verified

- **WHEN** a GET request is made to `/auth/verify/:token` with a valid, unexpired token
- **THEN** the user's `email_verified` is set to `true`
- **AND** the `verification_token` and `verification_expires` are cleared
- **AND** the response is a 302 redirect to the login page
- **AND** a flash message on the session indicates successful verification

#### Scenario: Expired token

- **WHEN** a GET request is made to `/auth/verify/:token` with a token whose `verification_expires` is in the past
- **THEN** the system returns a page with status 400 showing "This verification link has expired"
- **AND** the user record is unchanged

#### Scenario: Invalid or unknown token

- **WHEN** a GET request is made to `/auth/verify/:token` with a token not matching any user
- **THEN** the system returns a page with status 400 showing "Invalid verification link"
- **AND** no user record is modified

### Requirement: Login gates unverified users

The system SHALL prevent unverified users from authenticating via the session auth scheme.

#### Scenario: Unverified user denied login

- **WHEN** an unverified user (email_verified = false) attempts to log in with correct credentials
- **THEN** the `verify` function in the session auth scheme returns `null`
- **AND** the login page shows "Invalid email or password" (same as wrong credentials, to avoid user enumeration)

#### Scenario: Verified user allowed login

- **WHEN** a verified user (email_verified = true) attempts to log in with correct credentials
- **THEN** the `verify` function returns the user identity
- **AND** the session is populated and the user is redirected to the returnTo URL

#### Scenario: Admin user allowed login without verification

- **WHEN** an admin user (role = 'admin', pre-configured) attempts to log in with correct credentials
- **THEN** the verify function returns the user identity regardless of `email_verified` value
- **AND** the session is populated

### Requirement: Registration success page

The system SHALL render a "check your email" page after successful registration.

#### Scenario: Registration success page shown

- **WHEN** a user submits valid registration data and the account is created
- **THEN** the response renders a page informing the user to check their email for a verification link
- **AND** the page includes a note that the link expires in 24 hours
- **AND** the page includes a link to the login page
