## MODIFIED Requirements

### Requirement: Admin user password changes increment token_version

When an admin creates a new user with a password or updates an existing user's password, the system SHALL increment the target user's `token_version`.

#### Scenario: Admin creates user - password sets token_version

- **WHEN** an admin creates a new user and provides a password
- **THEN** the user SHALL have `token_version = 1`

#### Scenario: Admin updates user password

- **WHEN** an admin updates an existing user's password
- **THEN** the target user's `token_version` SHALL be incremented by 1
- **AND** the admin's own session SHALL remain valid
