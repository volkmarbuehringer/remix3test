## ADDED Requirements

### Requirement: Appointments within 24h cannot be updated

The system SHALL reject update requests for appointments at `/appointments/new/:id` when the appointment's start time is less than 24 hours from the current server time.

#### Scenario: Update appointment more than 24h ahead is allowed

- **WHEN** a user attempts to update an appointment whose start time is >= 24 hours from now
- **THEN** the system SHALL allow the update (subject to other validation rules)

#### Scenario: Update appointment less than 24h ahead is rejected

- **WHEN** a user attempts to update an appointment whose start time is < 24 hours from now
- **THEN** the system SHALL reject the update with error message "Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden."
- **AND** the appointment SHALL NOT be updated

#### Scenario: Update appointment already in the past is rejected

- **WHEN** a user attempts to update an appointment whose start time is <= Date.now()
- **THEN** the system SHALL reject the update with error message "Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."
- **AND** the appointment SHALL NOT be updated (existing behavior preserved)

### Requirement: Appointments within 24h cannot be deleted

The system SHALL reject deletion requests for appointments at `/appointments/new/:id` when the appointment's start time is less than 24 hours from the current server time.

#### Scenario: Delete appointment more than 24h ahead is allowed

- **WHEN** a user attempts to delete an appointment whose start time is >= 24 hours from now
- **THEN** the system SHALL allow the deletion (subject to other validation rules)

#### Scenario: Delete appointment less than 24h ahead is rejected

- **WHEN** a user attempts to delete an appointment whose start time is < 24 hours from now
- **THEN** the system SHALL reject the deletion with error message "Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden."
- **AND** the appointment SHALL NOT be deleted

#### Scenario: Delete appointment already in the past is rejected

- **WHEN** a non-admin user attempts to delete an appointment whose start time is <= Date.now()
- **THEN** the system SHALL reject the deletion (existing behavior preserved, handled by past-date-validation spec)

### Requirement: UI hides edit/delete buttons for appointments within 24h

The table at `/appointments/new` SHALL indicate visually when an appointment cannot be modified. The Bearbeiten and Löschen buttons SHALL be replaced by a locked indicator for rows whose start time is less than 24 hours from now.

#### Scenario: Appointments more than 24h ahead show action buttons

- **WHEN** a user views the appointments table at `/appointments/new`
- **AND** an appointment's start time is >= 24 hours from now
- **THEN** the row SHALL display Bearbeiten and Löschen buttons

#### Scenario: Appointments less than 24h ahead show locked indicator

- **WHEN** a user views the appointments table at `/appointments/new`
- **AND** an appointment's start time is < 24 hours from now
- **THEN** the row SHALL NOT display Bearbeiten or Löschen buttons
- **AND** the row SHALL display a locked icon or muted indicator (title attribute: "Nicht änderbar — weniger als 24 Stunden bis zum Beginn")
