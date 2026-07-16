## ADDED Requirements

### Requirement: Look up user by ID or email

The system SHALL provide a `lookup_user` tool that looks up a user by ID (integer) or email (string). Returns id, email, name, role, email_verified, disabled_at, and created_at. If `disabled_at` is not null, the account is disabled/locked.

#### Scenario: Look up user by ID

- **WHEN** the admin asks "tell me about user 42"
- **THEN** the agent calls `lookup_user` with id=42 and returns the user's details including disabled status

#### Scenario: Look up user by email

- **WHEN** the admin asks "find user with email test@example.com"
- **THEN** the agent calls `lookup_user` with email="test@example.com" and returns the user's details

#### Scenario: User not found

- **WHEN** the admin queries a non-existent user ID or email
- **THEN** the tool returns `{ found: false, message: "No user found..." }`

#### Scenario: Locked account shows disabled_at

- **WHEN** the user exists but has a non-null disabled_at timestamp
- **THEN** the tool returns the disabled_at value so the agent can report the account is locked

### Requirement: Lock user account

The system SHALL provide a `lock_user_account` tool that locks a user account by setting `disabled_at` to the current timestamp. This is a non-destructive lock — it does not delete appointments or data. Requires admin approval.

#### Scenario: Lock an active user

- **WHEN** the admin asks "lock user 42"
- **THEN** the agent calls `lock_user_account` with userId=42 and the tool sets disabled_at to now, then returns `{ success: true, message: "User account locked" }`

#### Scenario: User already locked

- **WHEN** the admin tries to lock an already-locked user
- **THEN** the tool returns `{ success: true, message: "User account is already locked" }` (idempotent)

#### Scenario: User not found

- **WHEN** the admin tries to lock a non-existent user
- **THEN** the tool returns `{ found: false, message: "No user found with id..." }`

### Requirement: Unlock user account

The system SHALL provide an `unlock_user_account` tool that re-enables a locked user account by setting `disabled_at` to null and incrementing `token_version` (invalidating existing sessions). Requires admin approval.

#### Scenario: Unlock a disabled user

- **WHEN** the admin asks "unlock user 42"
- **THEN** the agent calls `unlock_user_account` with userId=42 and the tool clears disabled_at and increments token_version, then returns `{ success: true, message: "User account unlocked" }`

#### Scenario: User is already active

- **WHEN** the admin tries to unlock a user that is not locked (disabled_at is null)
- **THEN** the tool returns `{ success: true, message: "User account is already active" }` (idempotent)

#### Scenario: User not found

- **WHEN** the admin tries to unlock a non-existent user
- **THEN** the tool returns `{ found: false, message: "No user found with id..." }`

## MODIFIED Requirements

### Requirement: Look up resource details

The system SHALL provide a `get_resource_details` tool that looks up a resource by ID or name. Returns id, name, description, and timestamps.

**No behavior change.**

#### Scenario: Look up resource by ID

- **WHEN** the admin asks "tell me about resource 5"
- **THEN** the agent calls `get_resource_details` with id=5 and returns the resource name, description, and timestamps

#### Scenario: Resource not found

- **WHEN** the admin queries a non-existent resource ID
- **THEN** the tool returns `{ found: false, message: "No resource found..." }`

### Requirement: Get offerings for a date

The system SHALL provide a `get_offerings_for_date` tool that returns all offering slots for a given date (ISO string or timestamp), joined with resource names.

**No behavior change.**

#### Scenario: Get offerings for a specific date

- **WHEN** the admin asks "what's available on 2026-07-10"
- **THEN** the agent calls `get_offerings_for_date` with the date and returns each slot's time range and resource name

#### Scenario: No offerings on that date

- **WHEN** the date has no offerings configured
- **THEN** the tool returns `{ count: 0, offerings: [] }`

### Requirement: Search appointments by date range

The system SHALL provide a `search_appointments_by_date_range` tool that returns appointments within a start and end date range. Start and end dates are required. Results are limited to 50.

**No behavior change.**

#### Scenario: Get appointments this week

- **WHEN** the admin asks "show me all appointments this week"
- **THEN** the agent uses `get_current_date_time` to determine the week bounds, then calls `search_appointments_by_date_range` with those bounds

#### Scenario: Date range too wide

- **WHEN** the date range exceeds 90 days
- **THEN** the tool returns an error "Date range exceeds maximum of 90 days"

### Requirement: Get user appointments

The system SHALL provide a `get_user_appointments` tool that returns all appointments for a given user ID, limited to 50 most recent.

**No behavior change.**

#### Scenario: Get appointments for a user

- **WHEN** the admin asks "what appointments does user 42 have"
- **THEN** the agent calls `get_user_appointments` with userId=42 and returns the user's appointments sorted by date

#### Scenario: User has no appointments

- **WHEN** the user exists but has no appointments
- **THEN** the tool returns `{ count: 0, appointments: [] }`

### Requirement: Get appointment details

The system SHALL provide a `get_appointment_details` tool that returns full details for a single appointment by ID, including user name and resource name.

**No behavior change.**

#### Scenario: Get full appointment information

- **WHEN** the admin asks "tell me about appointment 17"
- **THEN** the agent calls `get_appointment_details` with id=17 and returns the appointment title, date, time range, user name, resource name, and timestamps

### Requirement: Get offering config for a resource

The system SHALL provide a `get_offering_config_for_resource` tool that returns the offering configuration (rules) for a given resource ID.

**No behavior change.**

#### Scenario: Check offering rules for a resource

- **WHEN** the admin asks "how is resource 3 configured"
- **THEN** the agent calls `get_offering_config_for_resource` with resourceId=3 and returns the config rules

#### Scenario: Resource has no config

- **WHEN** the resource exists but has no offering config
- **THEN** the tool returns `{ found: false, message: "No offering config..." }`

### Requirement: List appointment types

The system SHALL provide a `get_appoint_types` tool that lists all appointment type labels.

**No behavior change.**

#### Scenario: List all types

- **WHEN** the admin asks "what appointment types exist"
- **THEN** the agent calls `get_appoint_types` and returns the list of types with their IDs and titles

### Requirement: Search messages

The system SHALL provide a `search_messages` tool that searches messages by content text (case-insensitive LIKE) or sender ID. Results limited to 50.

**No behavior change.**

#### Scenario: Search messages by keyword

- **WHEN** the admin asks "find messages about 'cancellation'"
- **THEN** the agent calls `search_messages` with a content query and returns matching messages with sender info and timestamps

#### Scenario: No messages match

- **WHEN** the search term matches no messages
- **THEN** the tool returns `{ count: 0, messages: [] }`

### Requirement: Get admin stats

The system SHALL provide a `get_admin_stats` tool that returns aggregate counts: total users (by role), total appointments (optionally filtered by date range), total resources, total messages.

**No behavior change.**

#### Scenario: Get dashboard stats

- **WHEN** the admin asks "how many users and appointments do we have"
- **THEN** the agent calls `get_admin_stats` and returns the aggregate counts

### Requirement: Look up holidays

The system SHALL provide a `lookup_holiday` tool that checks whether a given date is a public holiday in Rhineland-Palatinate, Germany, using the `date-holidays` package.

**No behavior change.**

#### Scenario: Check if a date is a holiday

- **WHEN** the admin asks "is July 10 a holiday"
- **THEN** the agent calls `lookup_holiday` with the date and returns the holiday name if applicable, or "not a holiday"

#### Scenario: Format holiday response

- **WHEN** the date is a holiday (e.g., 2026-12-25)
- **THEN** the tool returns `{ isHoliday: true, name: "Christmas Day", date: "2026-12-25" }`

### Requirement: Generate PDF report

The system SHALL provide a `generate_pdf_report` tool that generates a PDF for predefined report types: `appointment-list` (appointments in a date range), `user-list` (all users with role). Returns base64-encoded PDF data.

**No behavior change.**

#### Scenario: Generate appointment list PDF

- **WHEN** the admin asks "generate a PDF of this week's appointments"
- **THEN** the agent calls `generate_pdf_report` with report type "appointment-list", date range, and returns a base64 PDF

#### Scenario: Unknown report type

- **WHEN** the admin requests an unknown report type
- **THEN** the tool returns an error listing the valid report types

### Requirement: Get location context

The system SHALL provide a `get_location_context` tool that returns the default location: Ransbach-Baumbach, Rhineland-Palatinate, Germany. Used implicitly by the agent when location context is needed for weather, timezone, or holiday queries.

**No behavior change.**

#### Scenario: Agent determines timezone for sunrise/sunset

- **WHEN** the admin asks "what time is sunset"
- **THEN** the agent calls `get_location_context` to get the timezone and location, then uses that for the query

#### Scenario: Return location structure

- **WHEN** the tool is called
- **THEN** it returns `{ city: "Ransbach-Baumbach", region: "Rhineland-Palatinate", country: "Germany", countryCode: "DE", timezone: "Europe/Berlin", latitude: 50.4667, longitude: 7.7333 }`
