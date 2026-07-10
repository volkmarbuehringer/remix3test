## ADDED Requirements

### Requirement: Settings page shows delete account section

The settings page SHALL display a "Delete account" section below the password change form with a warning about permanent data loss and a require-password confirmation.

#### Scenario: Settings page renders delete account section

- **WHEN** authenticated user navigates to `GET /settings`
- **THEN** the page SHALL show a "Delete account" section with a warning that all data will be permanently removed
- **AND** the section SHALL include a password input field and a "Delete account" submit button

### Requirement: Delete account requires current password

The system SHALL require the user's current password before processing account deletion.

#### Scenario: Correct password starts deletion

- **WHEN** user enters their current password and submits the delete account form
- **THEN** the system SHALL delete the user account and all related data
- **AND** the session SHALL be invalidated
- **AND** the user SHALL be redirected to the login page

#### Scenario: Incorrect password shows error

- **WHEN** user enters an incorrect current password and submits the delete account form
- **THEN** the system SHALL NOT delete the account
- **AND** an error message "Current password is incorrect." SHALL be displayed

### Requirement: Deletion cleans up related records

The system SHALL clean up all database records that reference the deleted user before deleting the user record.

#### Scenario: Related records are handled before deletion

- **WHEN** user account is deleted
- **THEN** appointments owned by the user SHALL be cascaded (CASCADE)
- **AND** appointtypes owned by the user SHALL be cascaded (CASCADE)
- **AND** chatlog entries referencing the user SHALL be set to NULL (SET NULL)
- **AND** messages from the user SHALL be set to NULL sender
- **AND** workflow runs created by the user SHALL be set to NULL creator
- **AND** audit logs referencing the user as admin SHALL be cascaded (CASCADE)

### Requirement: Deletion is rate-limited

The delete account action SHALL be rate-limited per user to prevent abuse.

#### Scenario: Too many deletion attempts are blocked

- **WHEN** user submits more than 3 incorrect deletion attempts within 60 seconds
- **THEN** the system SHALL return HTTP 429
- **AND** display a "Too many attempts. Please try again later." error message

### Requirement: Deletion is logged to audit log

The system SHALL record account self-deletion in the audit log.

#### Scenario: Self-deletion is audited

- **WHEN** user account is successfully deleted
- **THEN** an audit log entry SHALL be created recording the user ID, email, action type "self-delete", and timestamp

### Requirement: Session is invalidated after deletion

After successful account deletion, the system SHALL invalidate the user's session and redirect to the login page.

#### Scenario: User is logged out after deletion

- **WHEN** user account is successfully deleted
- **THEN** the session SHALL be cleared (`session.unset('auth')`)
- **AND** the session ID SHALL be regenerated
- **AND** the user SHALL be redirected to `/auth/login`
