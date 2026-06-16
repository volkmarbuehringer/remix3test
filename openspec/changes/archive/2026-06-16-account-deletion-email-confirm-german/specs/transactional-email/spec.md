## MODIFIED Requirements

### Requirement: Verification email template

The system SHALL render verification emails in German using `remix/html-template` for safe HTML generation.

#### Scenario: Verification email content in German

- **WHEN** a verification email is composed for user "John" with token "abc123"
- **THEN** the subject is "Bestätigen Sie Ihre E-Mail-Adresse"
- **AND** the HTML body contains a German greeting addressing "John"
- **AND** the body contains a German-language link description for the verification URL (e.g., `https://example.com/auth/verify/abc123`)
- **AND** the body mentions the 24-hour expiration in German
- **AND** the body instructs the user to ignore the email if they didn't create the account
- **AND** the plain text body contains the same information in German as the HTML body

### Requirement: Password reset email template

The system SHALL render password reset emails in German using `remix/html-template` for safe HTML generation.

#### Scenario: Password reset email content in German

- **WHEN** a password reset email is composed for user "John" with token "abc123"
- **THEN** the subject is "Passwort zurücksetzen"
- **AND** the HTML body contains a German greeting addressing "John"
- **AND** the body confirms a password reset was requested in German
- **AND** the body contains a German-language link description for the reset URL
- **AND** the body mentions the 1-hour expiration in German
- **AND** the body instructs the user to ignore the email if they didn't request the reset
- **AND** the plain text body contains the same information in German as the HTML body

## ADDED Requirements

### Requirement: Account deletion confirmation email template

The system SHALL render account deletion confirmation emails in German using `remix/html-template` for safe HTML generation.

#### Scenario: Account deletion email content for self-deletion

- **WHEN** a deletion confirmation email is composed for user "John"
- **THEN** the subject is "Ihr Konto wurde gelöscht"
- **AND** the HTML body contains a German greeting addressing "John"
- **AND** the body confirms the account has been deleted in German
- **AND** the body states the action cannot be undone
- **AND** the body includes support contact information
- **AND** the plain text body contains the same information in German as the HTML body

#### Scenario: Account deletion email content for admin deletion

- **WHEN** a deletion confirmation email is composed for user "John" initiated by an admin
- **THEN** the subject is "Ihr Konto wurde gelöscht"
- **AND** the HTML body contains a German greeting addressing "John"
- **AND** the body indicates the deletion was initiated by an administrator in German
- **AND** the body includes support contact information
- **AND** the plain text body contains the same information in German as the HTML body
