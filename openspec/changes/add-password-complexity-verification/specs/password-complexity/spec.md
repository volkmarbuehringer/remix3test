## ADDED Requirements

### Requirement: Password complexity validation on registration

The registration form SHALL validate password complexity using the shared `validatePasswordComplexity()` function after schema-level checks pass.

#### Scenario: Registration with valid complex password

- **WHEN** user submits registration with a password meeting all complexity rules (≥10 chars, ≥1 digit, ≥1 special char)
- **THEN** the registration proceeds to email-uniqueness check

#### Scenario: Registration with short password

- **WHEN** user submits registration with a password shorter than 10 characters
- **THEN** the form is re-rendered with a complexity error message and a 400 status

#### Scenario: Registration with password missing digit

- **WHEN** user submits registration with a password ≥10 characters but containing no digit
- **THEN** the form is re-rendered with a "must contain at least one number" error message and a 400 status

#### Scenario: Registration with password missing special character

- **WHEN** user submits registration with a password ≥10 characters but containing no special character
- **THEN** the form is re-rendered with a "must contain at least one special character" error message and a 400 status

### Requirement: Password complexity validation on password reset

The password-reset form SHALL validate password complexity using the shared `validatePasswordComplexity()` function after schema-level checks pass.

#### Scenario: Reset with valid complex password

- **WHEN** user submits a password reset with a password meeting all complexity rules
- **THEN** the reset proceeds to token validation and password update

#### Scenario: Reset with weak password

- **WHEN** user submits a password reset with a password failing a complexity rule
- **THEN** the form is re-rendered with a complexity error message and a 400 status

### Requirement: Real-time client-side complexity feedback

Both registration and password-reset forms SHALL display a live checklist showing each complexity rule and its satisfaction status as the user types.

#### Scenario: Live feedback updates

- **WHEN** user types in the password field
- **THEN** a checklist below the input shows each rule (length, digit, special char) with a checkmark or circle indicator that updates in real time
