## ADDED Requirements

### Requirement: Newly created appointments have a 10-minute delete grace period

Non-admin users at `/appointments/new` SHALL be allowed to delete an appointment within 10 minutes of its creation, regardless of the 24h start-time cancellation policy.

#### Scenario: Delete within 10 minutes of creation is allowed

- **WHEN** a non-admin user attempts to delete an appointment that was created less than 10 minutes ago
- **AND** the appointment start time is less than 24 hours from now
- **THEN** the system SHALL allow the deletion (subject to other validation rules)

#### Scenario: Delete after 10 minutes but >24h from start is allowed

- **WHEN** a non-admin user attempts to delete an appointment that was created more than 10 minutes ago
- **AND** the appointment start time is >= 24 hours from now
- **THEN** the system SHALL allow the deletion (subject to other validation rules)

#### Scenario: Delete after 10 minutes and within 24h of start is blocked

- **WHEN** a non-admin user attempts to delete an appointment that was created more than 10 minutes ago
- **AND** the appointment start time is less than 24 hours from now
- **THEN** the system SHALL reject the deletion with error message "Termine können nur bis 24 Stunden vor Beginn bearbeitet oder gelöscht werden."
- **AND** the appointment SHALL NOT be deleted

### Requirement: Admin can always delete regardless of grace period

The admin override from the 24h cancellation policy extends to the grace period — admins are never blocked by either restriction.

#### Scenario: Admin deletes appointment within 24h, created >10min ago

- **WHEN** an admin user attempts to delete any appointment
- **AND** the appointment start time is less than 24 hours from now
- **AND** the appointment was created more than 10 minutes ago
- **THEN** the system SHALL allow the deletion

### Requirement: UI reflects grace period in blocked indicator

The `blocked` flag on appointment rows SHALL be `false` for rows created within the last 10 minutes, even if the start time is within 24h, so the delete button is visible.

#### Scenario: Recently created row shows delete button despite 24h start

- **WHEN** a non-admin user views the appointments table at `/appointments/new`
- **AND** an appointment's start time is less than 24 hours from now
- **AND** the appointment was created less than 10 minutes ago
- **THEN** the row SHALL display the delete button (not the locked indicator)
