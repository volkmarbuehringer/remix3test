## ADDED Requirements

### Requirement: Customer can cancel their own booking
The customer agent SHALL provide a `cancelBooking` tool that takes a booking ID and customer user ID, and triggers the `BookingCancellationWorkflow`. The workflow SHALL verify the booking belongs to the requesting customer before proceeding.

#### Scenario: Customer cancels own appointment
- **WHEN** a customer requests cancellation of their appointment
- **THEN** the agent calls `cancelBooking` with the booking ID
- **AND** the cancellation workflow verifies `appointment.userId === requestingUserId`
- **AND** if verified, the workflow proceeds with cancellation

#### Scenario: Customer tries to cancel another's booking
- **WHEN** a customer tries to cancel a booking that belongs to a different user
- **THEN** the workflow returns an error `{ error: 'not_owner' }`
- **AND** no changes are made to the appointment

### Requirement: Cancellation releases the slot
The `BookingCancellationWorkflow` SHALL delete the appointment record, freeing the time slot for other customers. The workflow SHALL verify the appointment has not already been cancelled.

#### Scenario: Successful cancellation
- **WHEN** the cancellation workflow is triggered with a valid booking ID owned by the customer
- **THEN** the appointment record is deleted from the database
- **AND** the workflow returns `{ success: true, cancelledAppointmentId: <id> }`

#### Scenario: Already cancelled
- **WHEN** the cancellation workflow is triggered for an appointment that was already deleted
- **THEN** the workflow returns `{ success: false, error: 'already_cancelled' }`
- **AND** no further action is taken

### Requirement: Compensation on cancellation notification failure
If the cancellation notification fails, the deletion SHALL NOT be rolled back (the slot is already freed). The failed notification SHALL be recorded in the `failed_notifications` queue.

#### Scenario: Cancellation notification fails
- **WHEN** the appointment is deleted successfully but the cancellation notification fails
- **THEN** the workflow SHALL still return success for the cancellation
- **AND** the failed notification is queued for retry
- **AND** no rollback of the deletion occurs
