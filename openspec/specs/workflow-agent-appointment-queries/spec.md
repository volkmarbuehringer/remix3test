**Purpose**: The workflow agent can answer appointment-related questions by navigating to `/verwaltung/appointments` with appropriate filter, period, and status query params.

## Requirements

### Requirement: Detect appointment questions

The workflow agent SHALL detect when the admin asks about appointments (as opposed to user management) and branch to the appointment navigation flow.

Appointment-related keywords include: "appointment", "appointments", "Termin", "Termine", "booking", "bookings", "Buchung", "Buchungen".

When an appointment question is detected, the agent SHALL determine whether the intent is to **check** appointments or to **delete** appointments on a resource, and return the appropriate structured JSON.

For **check** intent, the agent SHALL navigate to `/verwaltung/appointments` with a resolved user email as the filter. For **delete-resource** intent, the agent SHALL trigger the delete workflow. After navigating, the agent SHALL wait for the next question without running ask_user or consistency checks.

When a user management question is detected, the agent SHALL follow the existing unified flow (navigate to `/admin/users` → ask_user → execute → consistency_checks).

#### Scenario: Admin asks about a user's appointments by name

- **WHEN** the admin asks "what appointments does John have"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":"John"}`
- **AND** the controller resolves "John" to a user and navigates to `/verwaltung/appointments?filter=<email>`

#### Scenario: Admin asks to delete appointments on a resource

- **WHEN** the admin asks "delete all appointments for John in Raum A"
- **THEN** the agent returns `{"type":"appointment","action":"delete-resource","targetQuery":"John","resourceQuery":"Raum A"}`
- **AND** the controller resolves user and resource and starts the delete workflow

#### Scenario: Admin asks about appointments this week

- **WHEN** the admin asks "show me appointments this week"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":""}` with navigates to `/verwaltung/appointments` without a filter
- **NOTE**: Non-user-scoped queries (period-only, status-only) fall through to the original navigation without user resolution

#### Scenario: Admin asks about appointments this month

- **WHEN** the admin asks "appointments this month"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":""}` and navigates to `/verwaltung/appointments?period=this_month`

#### Scenario: Admin asks about appointments today

- **WHEN** the admin asks "what appointments are today"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":""}` and navigates to `/verwaltung/appointments?period=today`

#### Scenario: Admin asks about future appointments for a user by name

- **WHEN** the admin asks "show future appointments for John"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":"John"}`
- **AND** the controller resolves John and navigates to `/verwaltung/appointments?filter=<email>&status=pending`

#### Scenario: Admin asks about past appointments

- **WHEN** the admin asks "show me past appointments"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":""}`
- **AND** the controller navigates to `/verwaltung/appointments?status=expired`

#### Scenario: Admin asks about user management

- **WHEN** the admin asks "lock user 5" or "show me disabled users"
- **THEN** the agent follows the existing flow and returns `{"type":"user-action",...}`

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

The workflow agent SHALL combine `targetQuery`, `period`, and `status` when multiple dimensions are specified. The `targetQuery` drives user resolution; `period` and `status` are appended as query params directly.

#### Scenario: Combined user and period

- **WHEN** the admin asks "appointments for John this week"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":"John","period":"this_week"}`
- **AND** the controller resolves John and navigates to `/verwaltung/appointments?filter=<email>&period=this_week`
