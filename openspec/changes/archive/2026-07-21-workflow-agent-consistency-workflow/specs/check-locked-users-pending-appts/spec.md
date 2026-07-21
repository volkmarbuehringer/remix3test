## ADDED Requirements

### Requirement: Report locked users with pending appointments

The system SHALL query the database for all locked (disabled) users who have future appointments and return a list with user details and appointment counts.

Each result entry SHALL include user id, name, email, and count of pending (future) appointments.

#### Scenario: Locked users with pending appointments found
- **WHEN** the consistency check runs
- **AND** there are locked users with future appointments
- **THEN** the step returns a list of `{id, name, email, pendingCount}`
- **AND** the agent reports these to the admin

#### Scenario: No locked users with pending appointments
- **WHEN** the consistency check runs
- **AND** no locked users have future appointments
- **THEN** the step returns an empty list
- **AND** the agent reports no issues found

#### Scenario: No locked users at all
- **WHEN** the consistency check runs
- **AND** there are no locked users in the system
- **THEN** the step returns an empty list
