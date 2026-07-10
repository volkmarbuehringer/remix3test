## ADDED Requirements

### Requirement: Notification sender has a pluggable interface

The system SHALL define a `NotificationSender` interface with a `send` method accepting recipient, notification type, and data payload. The interface SHALL NOT depend on any specific provider (console, email, SMS). The initial implementation SHALL be a `ConsoleNotificationSender` that logs to stdout for development.

#### Scenario: Console sender logs notification

- **WHEN** `ConsoleNotificationSender.send` is called with any recipient and type
- **THEN** it returns `{ sent: true, provider: 'console' }`
- **AND** a log entry is written to stdout with notification details

### Requirement: Booking confirmation notification

When a booking is successfully created, the `CustomerBookingWorkflow` SHALL call `NotificationSender.send` with type `confirmation`, the customer's email/contact info, and the appointment details (resource name, date, time, booking ID).

#### Scenario: Confirmation sent after successful booking

- **WHEN** `createAppointment` succeeds in the booking workflow
- **THEN** the workflow calls `sendConfirmation` with the customer's contact info and appointment details
- **AND** the workflow waits for the notification result before transitioning to done

### Requirement: Notification failure is non-blocking

If the notification step fails, the booking SHALL remain confirmed. The failed notification SHALL be recorded in a `failed_notifications` queue for retry. The workflow SHALL complete successfully even if the notification fails.

#### Scenario: Confirmation notification fails but booking persists

- **WHEN** `sendConfirmation` throws or returns an error
- **THEN** the workflow SHALL still return success for the booking
- **AND** the failed notification SHALL be recorded in the `failed_notifications` queue
- **AND** the workflow emits a warning span with `step.outcome: "notification_failed"`

### Requirement: Cancellation notification

When a booking is cancelled, the `BookingCancellationWorkflow` SHALL call `NotificationSender.send` with type `cancellation` and the relevant appointment and customer details.

#### Scenario: Cancellation notification sent

- **WHEN** the cancellation workflow completes
- **THEN** it calls `send` with type `cancellation`
- **AND** the customer receives notification that their appointment was cancelled
