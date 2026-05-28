## ADDED Requirements

### Requirement: Session ID is regenerated on successful login

The system SHALL call `session.regenerate()` before setting auth data in the session on successful login. This prevents session fixation attacks by issuing a new session ID after authentication.

#### Scenario: Successful login regenerates session

- **WHEN** a user provides valid credentials and completes authentication
- **THEN** the session ID is regenerated via `session.regenerate()` before auth data (`session.set('auth', ...)`) is written

#### Scenario: Failed login does not regenerate session

- **WHEN** a user submits invalid credentials and authentication fails
- **THEN** the session ID is NOT regenerated and the session remains unchanged

### Requirement: Session ID is regenerated on logout

The system SHALL regenerate the session ID during logout. *(Already implemented — verification only.)*

#### Scenario: Logout regenerates session

- **WHEN** a user submits a logout request
- **THEN** the session ID is regenerated via `session.regenerate()` before the session is destroyed
