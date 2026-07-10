## ADDED Requirements

### Requirement: Admin appointments page subscribes to SSE invalidation events

The admin appointments page SHALL subscribe to the existing `appointmentChannel` via SSE to receive real-time invalidation events. When an `invalidate` event is received, the page SHALL automatically reload to display the latest data.

#### Scenario: Admin page receives invalidation event

- **WHEN** an admin is viewing `/admin/appointments`
- **AND** an `invalidate` event is received via the SSE connection
- **AND** the admin is not currently editing or creating an appointment
- **THEN** the page SHALL reload to reflect latest data

#### Scenario: Invalidation suppressed during active edit

- **WHEN** an admin is viewing `/admin/appointments?editing=123`
- **AND** an `invalidate` event is received via the SSE connection
- **THEN** the page SHALL NOT reload

#### Scenario: Invalidation suppressed during active create

- **WHEN** an admin is viewing `/admin/appointments?creating=true`
- **AND** an `invalidate` event is received via the SSE connection
- **THEN** the page SHALL NOT reload

### Requirement: Admin page provides SSE endpoint

The admin appointments controller SHALL expose an `events` route that subscribes to the `appointmentChannel` via SSE, returning a `text/event-stream` response.

#### Scenario: Admin subscribes to events

- **WHEN** the admin page establishes an EventSource connection to `/admin/appointments/events`
- **THEN** the server SHALL return a `text/event-stream` response with a `connected` event
- **AND** the server SHALL send heartbeat pings at regular intervals to keep the connection alive

### Requirement: Admin mutations broadcast invalidation

All CRUD operations (create, update, delete) on the admin appointments controller SHALL broadcast an `invalidate` event via the `appointmentChannel` after successful mutation, ensuring other sessions receive the update.

#### Scenario: Admin creates an appointment

- **WHEN** an admin creates a new appointment via the admin form
- **AND** the creation succeeds
- **THEN** the server SHALL broadcast `invalidate` via `appointmentChannel`
- **AND** redirect back to the admin appointments list

#### Scenario: Admin updates an appointment

- **WHEN** an admin updates an existing appointment via the admin form
- **AND** the update succeeds
- **THEN** the server SHALL broadcast `invalidate` via `appointmentChannel`
- **AND** redirect back to the admin appointments list

#### Scenario: Admin deletes an appointment

- **WHEN** an admin deletes an appointment via the admin form
- **AND** the deletion succeeds
- **THEN** the server SHALL broadcast `invalidate` via `appointmentChannel`
- **AND** redirect back to the admin appointments list
