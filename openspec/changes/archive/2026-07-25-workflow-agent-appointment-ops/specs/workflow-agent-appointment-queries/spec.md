## MODIFIED Requirements

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

### Requirement: Combine filter, period, and status

The workflow agent SHALL combine `targetQuery`, `period`, and `status` when multiple dimensions are specified. The `targetQuery` drives user resolution; `period` and `status` are appended as query params directly.

#### Scenario: Combined user and period

- **WHEN** the admin asks "appointments for John this week"
- **THEN** the agent returns `{"type":"appointment","action":"check","targetQuery":"John","period":"this_week"}`
- **AND** the controller resolves John and navigates to `/verwaltung/appointments?filter=<email>&period=this_week`
