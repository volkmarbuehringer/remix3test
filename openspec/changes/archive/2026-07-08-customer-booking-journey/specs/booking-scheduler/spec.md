## ADDED Requirements

### Requirement: Cron-triggered reminder workflow

The system SHALL have a `BookingReminderWorkflow` triggered on a daily cron schedule. It SHALL query all appointments occurring in the next 24 hours and send a reminder notification for each.

#### Scenario: Reminders sent for upcoming appointments

- **WHEN** the daily cron triggers the reminder workflow
- **THEN** the workflow queries appointments where `date` is within the next 24 hours
- **AND** for each appointment found, it calls `NotificationSender.send` with type `reminder`

### Requirement: Skip cancelled appointments

Before sending a reminder for an appointment, the reminder workflow SHALL verify the appointment still exists. If the appointment was cancelled between the query and the notification, it SHALL skip it silently.

#### Scenario: Appointment cancelled just before reminder

- **WHEN** the reminder workflow attempts to send a reminder for an appointment that no longer exists
- **THEN** it SHALL skip the notification silently
- **AND** continue processing remaining appointments

### Requirement: Configurable reminder window

The reminder window SHALL be configurable via environment variable (`REMINDER_WINDOW_HOURS`, default 24). This allows adjusting how far in advance reminders are sent.

#### Scenario: Custom reminder window

- **WHEN** `REMINDER_WINDOW_HOURS` is set to 48
- **THEN** the reminder workflow queries appointments within the next 48 hours
