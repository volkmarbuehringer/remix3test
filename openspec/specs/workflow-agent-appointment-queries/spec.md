**Purpose**: The workflow agent can answer appointment-related questions by navigating to `/verwaltung/appointments` with appropriate filter, period, and status query params.

## Requirements

### Requirement: Detect appointment questions

The workflow agent SHALL detect when the admin asks about appointments (as opposed to user management) and branch to the appointment navigation flow.

Appointment-related keywords include: "appointment", "appointments", "Termin", "Termine", "booking", "bookings", "Buchung", "Buchungen".

When an appointment question is detected, the agent SHALL navigate to `/verwaltung/appointments` with appropriate query parameters instead of following the user account flow. After navigating, the agent SHALL wait for the next question without running ask_user or consistency checks.

When a user management question is detected, the agent SHALL follow the existing unified flow (navigate to `/admin/users` → ask_user → execute → consistency_checks).

#### Scenario: Admin asks about a user's appointments

- **WHEN** the admin asks "what appointments does user 5 have"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ filter: "5" }` or `{ filter: "<email>" }` if the email is known

#### Scenario: Admin asks about appointments this week

- **WHEN** the admin asks "show me appointments this week"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ period: "this_week" }`

#### Scenario: Admin asks about appointments this month

- **WHEN** the admin asks "appointments this month"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ period: "this_month" }`

#### Scenario: Admin asks about appointments today

- **WHEN** the admin asks "what appointments are today"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ period: "today" }`

#### Scenario: Admin asks about future appointments for a user by name

- **WHEN** the admin asks "show future appointments for john@example.com"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ filter: "john@example.com", status: "pending" }`

#### Scenario: Admin asks about past appointments

- **WHEN** the admin asks "show me past appointments"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ status: "expired" }`

#### Scenario: Admin asks about user management

- **WHEN** the admin asks "lock user 5" or "show me disabled users"
- **THEN** the agent follows the existing unified flow: navigate to `/admin/users` with appropriate filter, ask_user, execute action, run consistency checks

### Requirement: Map date references to period values

The workflow agent SHALL map natural language date references to the `period` parameter values supported by `/verwaltung/appointments`:

| Natural language | period value |
|---|---|
| "today", "heute" | `today` |
| "this week", "diese Woche" | `this_week` |
| "this month", "dieser Monat" | `this_month` |
| "this year", "dieses Jahr" | `this_year` |
| "next week", "nächste Woche" | `next_week` |
| "next month", "nächster Monat" | `next_month` |

#### Scenario: Map "this week" correctly

- **WHEN** the admin asks about "appointments this week"
- **THEN** the agent uses `period: "this_week"` in the navigate call

#### Scenario: Map "heute" correctly

- **WHEN** the admin asks "Termine heute"
- **THEN** the agent uses `period: "today"` in the navigate call

### Requirement: Map status references to status values

The workflow agent SHALL map natural language status references to the `status` parameter:

| Natural language | status value |
|---|---|
| "future", "pending", "upcoming", "zukünftig", "anstehend" | `pending` |
| "past", "expired", "vergangen", "abgelaufen" | `expired` |

#### Scenario: Map "upcoming appointments" correctly

- **WHEN** the admin asks "show upcoming appointments"
- **THEN** the agent uses `status: "pending"` and no `period` in the navigate call

### Requirement: Combine filter, period, and status

The workflow agent SHALL combine `filter`, `period`, and `status` when multiple dimensions are specified. If no appointment-specific query is given, the agent SHALL navigate to `/verwaltung/appointments` without query params (showing the default view of pending future appointments).

#### Scenario: Combined filter and period

- **WHEN** the admin asks "appointments for user 5 this week"
- **THEN** the agent calls `navigate` with path `/verwaltung/appointments` and query `{ filter: "5", period: "this_week" }`
