## Purpose

Cross-cutting validation rules that prevent creation and modification of appointments and offerings with dates in the past, while allowing admin-only deletion of past records.

## Requirements

### Requirement: Appointments must not be created or updated with past dates

The system SHALL reject creation of appointments whose `date` (epoch ms, UTC midnight) is less than the current UTC day at midnight. The update restriction was replaced by a forward-looking 24h cancellation policy (see appointment-calendar spec).

#### Scenario: Create appointment with past date rejected

- **WHEN** a user or admin attempts to create an appointment with a `date` that is before today (UTC)
- **THEN** the system SHALL reject the write with error message `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the appointment SHALL NOT be created

#### Scenario: Create appointment with today's date allowed

- **WHEN** a user or admin attempts to create an appointment with a `date` equal to today (UTC)
- **THEN** the system SHALL allow the creation (subject to other validation rules)

#### Scenario: Create appointment with future date allowed

- **WHEN** a user or admin attempts to create an appointment with a `date` that is after today (UTC)
- **THEN** the system SHALL allow the creation (subject to other validation rules)

### Requirement: Offerings must not be created or updated with past dates

The system SHALL reject creation of offerings whose `day` (epoch ms, UTC midnight) is less than the current UTC day at midnight. Offering update restriction is covered by the admin controllers' existing inline checks.

#### Scenario: Create offering with past date rejected

- **WHEN** an admin attempts to create an offering with a `day` that is before today (UTC)
- **THEN** the system SHALL reject the write with error message `"Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the offering SHALL NOT be created

#### Scenario: Create offering with today's date allowed

- **WHEN** an admin attempts to create an offering with a `day` equal to today (UTC)
- **THEN** the system SHALL allow the creation (subject to other validation rules)

#### Scenario: Create offering with future date allowed

- **WHEN** an admin attempts to create an offering with a `day` that is after today (UTC)
- **THEN** the system SHALL allow the creation (subject to other validation rules)

### Requirement: Past appointment deletion restricted to admins

The system SHALL allow deletion of appointments with past dates only when the requesting user has role `admin`. Non-admin users attempting to delete past appointments SHALL receive an error.

#### Scenario: Admin deletes past appointment

- **WHEN** an admin user attempts to delete an appointment whose `date` is before today (UTC)
- **THEN** the system SHALL allow the deletion

#### Scenario: Non-admin deletes past appointment rejected

- **WHEN** a non-admin user attempts to delete an appointment whose `date` is before today (UTC)
- **THEN** the system SHALL reject the deletion with error message `"Termine in der Vergangenheit können nur von Administratoren gelöscht werden."`
- **AND** the appointment SHALL NOT be deleted

#### Scenario: Non-admin deletes future appointment allowed

- **WHEN** a non-admin user attempts to delete an appointment whose `date` equals today or is in the future (UTC)
- **THEN** the system SHALL allow the deletion (subject to other validation rules)

### Requirement: Past offering deletion restricted to admins

The system SHALL allow deletion of offerings with past dates only when the requesting user has role `admin`. Non-admin users attempting to delete past offerings SHALL receive an error.

#### Scenario: Admin deletes past offering

- **WHEN** an admin user attempts to delete an offering whose `day` is before today (UTC)
- **THEN** the system SHALL allow the deletion

#### Scenario: Non-admin deletes past offering rejected

- **WHEN** a non-admin user attempts to delete an offering whose `day` is before today (UTC)
- **THEN** the system SHALL reject the deletion with error message `"Angebote in der Vergangenheit können nur von Administratoren gelöscht werden."`
- **AND** the offering SHALL NOT be deleted

#### Scenario: Non-admin deletes future offering allowed

- **WHEN** a non-admin user attempts to delete an offering whose `day` equals today or is in the future (UTC)
- **THEN** the system SHALL allow the deletion (subject to other validation rules)
