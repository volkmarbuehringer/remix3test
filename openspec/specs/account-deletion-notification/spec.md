## Purpose

Notify users via email when their account is deleted, whether by self-service or by an administrator. Email content is in German.

## ADDED Requirements

### Requirement: Self-deletion confirmation email

The system SHALL send a confirmation email to the user when they successfully delete their own account via the Settings page.

#### Scenario: Confirmation email sent on self-deletion

- **WHEN** a user submits valid credentials and confirms self-deletion
- **THEN** the system sends an email to the user's email address
- **AND** the email subject is in German
- **AND** the email body is in German
- **AND** the email acknowledges the account deletion
- **AND** the email includes a note that the action cannot be undone
- **AND** the email includes support contact information
- **AND** the email is sent before the session is destroyed
- **AND** the account deletion proceeds even if email delivery fails

### Requirement: Admin-initiated deletion confirmation email

The system SHALL send a confirmation email to the user when an admin deletes their account.

#### Scenario: Confirmation email sent on admin deletion

- **WHEN** an admin deletes a user account via the admin panel
- **THEN** the system sends an email to the deleted user's email address
- **AND** the email subject is in German
- **AND** the email body is in German
- **AND** the email acknowledges the account deletion
- **AND** the email indicates the deletion was initiated by an administrator
- **AND** the email includes support contact information
- **AND** the account deletion proceeds even if email delivery fails

#### Scenario: User email fetched before deletion

- **WHEN** an admin initiates user deletion
- **THEN** the user's email address is read from the database before the delete operation
- **AND** the email is sent after the deletion transaction completes
