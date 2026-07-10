## ADDED Requirements

### Requirement: Customer can start a booking through the agent

The customer agent SHALL accept a free-text problem description from the customer and trigger the `CustomerBookingWorkflow` via the `triggerBookingWorkflow` tool. The workflow SHALL receive the customer's user ID, the matched resource ID, the problem description, and any preferred time constraints extracted by the agent.

#### Scenario: Agent triggers workflow from customer intent

- **WHEN** a customer describes a problem (e.g., "I need a massage for my back pain")
- **THEN** the customer agent calls `searchResourcesByCapability` to find matching resources
- **AND** the agent calls `triggerBookingWorkflow` with the best-matched resource ID and customer context
- **AND** the workflow is created with status `pending`

### Requirement: Workflow finds available slots

The `CustomerBookingWorkflow` SHALL query the database for available offering slots for the matched resource within configurable lookahead (default 180 days). It SHALL return up to 10 future days with available slots, excluding past times and already-booked slots.

#### Scenario: Slots found for a resource

- **WHEN** the workflow runs `findAvailableSlots` for a resource with available offerings
- **THEN** it returns an array of slots with `date_epoch_ms`, `start_min`, `end_min`, and `resource_name`
- **AND** it excludes any slots that are in the past or already booked

#### Scenario: No slots available

- **WHEN** the workflow runs `findAvailableSlots` and no offerings exist for the resource in the lookahead period
- **THEN** the workflow SHALL return an error outcome with message "Keine freien Termine verfügbar"

### Requirement: Workflow supports human-in-the-loop slot selection

After finding available slots, the `CustomerBookingWorkflow` SHALL pause and wait for the customer to select a specific time slot. The selection SHALL be communicated back to the workflow via a `confirmBooking` tool or SSE event.

#### Scenario: Customer selects a slot

- **WHEN** the customer picks a specific slot from the presented options
- **THEN** the workflow resumes with the selected `date`, `resourceId`, `startMin`, and `title`
- **AND** the workflow transitions to the `createAppointment` step

#### Scenario: Human-in-the-loop timeout

- **WHEN** the customer does not select a slot within a configurable timeout (default 30 minutes)
- **THEN** the workflow SHALL expire and transition to `cancelled` status
- **AND** no appointment is created

### Requirement: Workflow creates appointment with collision detection

The `CustomerBookingWorkflow` SHALL create the appointment record with an exclusion constraint check. If a collision is detected (another booking occupies the same slot), the workflow SHALL not create the appointment, return a `collision` error, and present the next available slot to the customer.

#### Scenario: Successful booking

- **WHEN** the selected slot is still available
- **THEN** the workflow creates the appointment record with `userId`, `resourceId`, `title`, `dayMs`, and `during` fields
- **AND** the workflow returns `{ success: true, id: <appointmentId> }`

#### Scenario: Slot collision

- **WHEN** another booking occupied the slot between presentation and confirmation
- **THEN** the workflow SHALL NOT create the appointment
- **AND** it SHALL return `{ success: false, error: 'collision' }`
- **AND** it SHALL automatically re-run the `findAvailableSlots` step to find the next available slot

### Requirement: Compensation on partial failure

If any step in the main booking path fails after a mutating step has already succeeded, the workflow SHALL execute compensating actions to roll back. Specifically: if `sendConfirmation` fails after `createAppointment` succeeds, a `releaseAppointment` step SHALL delete the newly created appointment.

#### Scenario: Notification failure triggers rollback

- **WHEN** `createAppointment` succeeds but `sendConfirmation` fails
- **THEN** the workflow SHALL call `releaseAppointment` to delete the appointment record
- **AND** the workflow SHALL return an error outcome indicating the booking was rolled back due to notification failure

### Requirement: Workflow generates observability events

Each step of the `CustomerBookingWorkflow` SHALL emit custom span attributes including `workflow.id`, `customer.id`, `resource.id`, `step.id`, and `step.outcome` (success/failure/compensated). Step duration SHALL be recorded. A workflow run status record SHALL be written to a dedicated `workflow_runs` table for admin dashboard queries.

#### Scenario: Step completes successfully

- **WHEN** any workflow step completes
- **THEN** Mastra observability emits a span with `step.outcome: "success"` and `step.duration_ms`
- **AND** the `workflow_runs` table is updated with the latest step status

#### Scenario: Step fails

- **WHEN** any workflow step throws an error or returns an error outcome
- **THEN** Mastra observability emits a span with `step.outcome: "failure"` and the error message
- **AND** compensation steps are triggered if applicable
