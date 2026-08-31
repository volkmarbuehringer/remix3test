## ADDED Requirements

### Requirement: Lookup-user intent classification

The system SHALL classify a bare user lookup request as a `lookup-user` intent that navigates to the users page with the resolved target as a filter, without starting a workflow run.

#### Scenario: Admin asks to find a user

- **WHEN** an admin submits a message that resolves to a bare user lookup (e.g. "find user john doe", "zeig mir benutzer 42")
- **THEN** the pipeline SHALL emit `intent.classified` with intent `lookup-user` and the target query
- **AND** the pipeline SHALL navigate to `/admin/users?filter=<target>` without starting a workflow run

#### Scenario: Lookup does not open a confirm gate

- **WHEN** the pipeline classifies a `lookup-user` intent
- **THEN** no workflow run SHALL be started
- **AND** no confirm gate SHALL be presented

### Requirement: Appointment check carries period and status filters

The `show-appointments` classification SHALL preserve the admin's date-period and status references and pass them as `period` and `status` query parameters on the `/verwaltung/appointments` navigation, in addition to the resolved user filter.

#### Scenario: Admin asks about appointments this week

- **WHEN** an admin submits a message referencing a date period (e.g. "show appointments this week", "Termine nächsten Monat")
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` with the matching `period` query parameter (e.g. `this-week`, `next-month`)
- **AND** a resolved target SHALL be included as the `filter` query parameter

#### Scenario: Admin asks about pending appointments

- **WHEN** an admin submits a message referencing a status (e.g. "pending appointments", "expired Termine")
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` with the matching `status` query parameter

#### Scenario: General appointment query carries no filters

- **WHEN** an admin submits a general appointment query without a target, period, or status
- **THEN** the pipeline SHALL navigate to `/verwaltung/appointments` without `filter`, `period`, or `status` query parameters