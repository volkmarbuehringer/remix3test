## ADDED Requirements

### Requirement: Session auth data SHALL carry token_version

The session auth data SHALL include a `tv` (token_version) field alongside `userId`. The value SHALL be read from the `users.token_version` column at login time.

#### Scenario: Login stores tv in session

- **WHEN** a user successfully authenticates (via login, not session restore)
- **THEN** the session SHALL store `auth = { userId: <user.id>, tv: <user.token_version> }`

### Requirement: Auth verify SHALL reject stale token_version

The auth middleware's `verify()` function SHALL additionally check that the session's `tv` matches the user's current `token_version` in the database. If they differ, `verify()` SHALL return `null` (session invalidated).

#### Scenario: Session created before password change is rejected

- **WHEN** a request is made with a session whose `tv` is lower than the user's current `token_version`
- **THEN** `verify()` SHALL return `null`
- **AND** the middleware SHALL treat this as unauthenticated (redirect to login or return 401)

#### Scenario: Session created after password change is accepted

- **WHEN** a request is made with a session whose `tv` equals the user's current `token_version`
- **THEN** `verify()` SHALL return the user object

#### Scenario: Session without tv field is rejected

- **WHEN** a request is made with a session whose `auth` data contains `userId` but no `tv`
- **THEN** `verify()` SHALL return `null`
- **AND** the user SHALL be required to log in again (one-time event for all pre-existing sessions)

### Requirement: Password reset SHALL increment token_version

The password reset flow SHALL increment `users.token_version` when updating the password hash. The handler SHALL also call `session.regenerateId(true)` before clearing `auth`.

#### Scenario: Password reset logs out other devices

- **WHEN** a user completes a password reset
- **THEN** the user's `token_version` in the database SHALL be incremented by 1
- **AND** the current session SHALL have its ID regenerated and `auth` cleared
- **AND** all other sessions with the old `tv` SHALL be invalidated on their next request

### Requirement: Settings password change SHALL increment token_version and re-issue auth

The settings password change handler SHALL increment `users.token_version`, then re-issue the session auth with the new `tv` so the current device remains authenticated.

#### Scenario: Settings password change keeps current device logged in

- **WHEN** a user changes their password via the settings page
- **THEN** the user's `token_version` SHALL be incremented
- **AND** the current session SHALL be updated with `auth = { userId: <id>, tv: <new token_version> }`
- **AND** other devices with the old `tv` SHALL be invalidated on their next request

### Requirement: Admin user management SHALL increment token_version on password changes

When an admin creates or updates a user and sets a password, the target user's `token_version` SHALL be incremented.

#### Scenario: Admin creates user with password

- **WHEN** an admin creates a new user and provides a password
- **THEN** the new user SHALL have `token_version = 1` (migration default)

#### Scenario: Admin updates user password

- **WHEN** an admin updates an existing user's password
- **THEN** the target user's `token_version` SHALL be incremented by 1
- **AND** the admin's own session SHALL be unaffected
