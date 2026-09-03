# booking-notifications Specification

## Purpose

Lets appointment customers receive confirmation, reminder, and cancellation notices for their own bookings inside the app, with read-state and live unread surfacing — replacing today's no-op `console.log` stub that delivers nothing to the user.

## Requirements

### Requirement: Booking notifications are stored per user

The system SHALL persist a notification record for each confirmation, cancellation, and reminder-relevant appointment, scoped to the user who owns the appointment.

#### Scenario: Confirmation stored for the booking customer

- **WHEN** a user books an appointment successfully
- **THEN** a `confirmation` notification referencing that appointment is created for that user

#### Scenario: Cancellation stored for the affected user

- **WHEN** a booking is cancelled, by the user or by an administrator
- **THEN** a `cancellation` notification referencing that appointment is created for the user who owned the appointment

#### Scenario: Reminder stored ahead of the appointment

- **WHEN** the scheduled reminder run finds an upcoming appointment inside the reminder window
- **THEN** a `reminder` notification referencing that appointment is created for the appointment's owner

### Requirement: Notifications are user-scoped and private

The system SHALL expose a user's notifications only to that user and SHALL NOT leak one user's notifications to another.

#### Scenario: A user cannot read another user's notifications

- **WHEN** a user requests notifications belonging to a different user
- **THEN** the request is denied and no cross-user notification data is returned

### Requirement: Read state is tracked per notification

The system SHALL track whether each notification has been read and SHALL expose an unread count derived from that state.

#### Scenario: Unread count reflects unread notifications

- **WHEN** a user has notifications that have not been marked read
- **THEN** the unread count equals the number of notifications whose read state is not set

#### Scenario: Read actions update the count

- **WHEN** a user reads or marks-as-read a notification
- **THEN** the unread count decreases accordingly
- **AND** when a user marks all notifications as read, the unread count becomes zero

### Requirement: Live unread surfacing in the navigation

The system SHALL surface the user's unread count in the main navigation and update it live when a new notification arrives, without a full page reload.

#### Scenario: New notification updates the badge live

- **WHEN** a new notification is created for the user while they are using the app
- **THEN** the navigation badge reflects the updated unread count without a manual refresh

#### Scenario: No badge when there is nothing unread

- **WHEN** a user has no unread notifications
- **THEN** the navigation does not show an active unread badge

### Requirement: Notifications inbox page

The system SHALL provide an authenticated inbox page listing the current user's notifications, newest first.

#### Scenario: Authenticated user views their notifications

- **WHEN** an authenticated user opens the notifications page
- **THEN** the page lists that user's notifications in reverse chronological order
- **AND** each notification links to the related appointment

#### Scenario: Unauthenticated access is denied

- **WHEN** an unauthenticated user requests the notifications page
- **THEN** they are redirected to authentication
