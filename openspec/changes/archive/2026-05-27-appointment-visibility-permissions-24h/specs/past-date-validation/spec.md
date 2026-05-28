## MODIFIED Requirements

### Requirement: Appointments must not be created or updated with past dates

The system SHALL reject creation of appointments whose `date` (epoch ms, UTC midnight) is less than the current UTC day at midnight. The update past-date check is replaced by a forward-looking 24h cancellation policy (see appointment-calendar spec).

#### Scenario: Create appointment with past date rejected (unchanged)

- **WHEN** a user or admin attempts to create an appointment with a `date` that is before today (UTC)
- **THEN** the system SHALL reject the write with error message `"Termine in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the appointment SHALL NOT be created

#### Scenario: Update appointment to past date (removed — replaced by 24h cancellation policy)
**Reason**: Update restriction is now based on the forward-looking 24h cancellation window, not past-date check. See appointment-calendar spec for the new update rules.

### Requirement: Offerings must not be created or updated with past dates

The system SHALL reject creation of offerings whose `day` (epoch ms, UTC midnight) is less than the current UTC day at midnight. (Unchanged — offering update restriction is covered by the admin controllers' existing inline checks.)

#### Scenario: Create offering with past date rejected (unchanged)

- **WHEN** an admin attempts to create an offering with a `day` that is before today (UTC)
- **THEN** the system SHALL reject the write with error message `"Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden."`
- **AND** the offering SHALL NOT be created
