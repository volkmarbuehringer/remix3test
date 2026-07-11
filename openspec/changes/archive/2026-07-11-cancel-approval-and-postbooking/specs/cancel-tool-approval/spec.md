## ADDED Requirements

### Requirement: cancelBooking requires approval

The `cancelBooking` tool SHALL have `requireApproval: true`. When the agent calls it, the system SHALL suspend execution and present a confirmation card showing the appointment summary. The appointment is only cancelled if the customer approves.

#### Scenario: Agent triggers cancelBooking and system suspends

- **WHEN** the agent calls `cancelBooking` with an `appointmentId` and `appointmentSummary`
- **THEN** the system suspends with `finishReason === 'suspended'`
- **AND** the suspend payload SHALL contain the tool args including `appointmentSummary`

#### Scenario: Customer approves cancellation

- **WHEN** the customer clicks "Ja, stornieren" on the approval card
- **THEN** the system calls `agent.approveToolCallGenerate`
- **AND** the cancellation workflow executes
- **AND** the customer sees a success message

#### Scenario: Customer declines cancellation

- **WHEN** the customer clicks "Nein" on the approval card
- **THEN** the system calls `agent.declineToolCallGenerate`
- **AND** the agent informs the customer that the cancellation was aborted

#### Scenario: Approval card shows appointment details

- **WHEN** the approval card is rendered for `cancelBooking`
- **THEN** the card SHALL display the `appointmentSummary` text (e.g., "Massage, 15.07.2026, 14:00–15:00 Uhr")
- **AND** the card SHALL use danger/warning styling (not the primary action color used for resource confirmation)
- **AND** the card SHALL have "Ja, stornieren" and "Nein" buttons

### Requirement: cancelAllAppointments requires approval

The `cancelAllAppointments` tool SHALL have `requireApproval: true`. The confirmation card SHALL show the number of appointments and optionally a summary list.

#### Scenario: Agent triggers cancelAllAppointments and system suspends

- **WHEN** the agent calls `cancelAllAppointments` with `count` and `appointmentSummaries`
- **THEN** the system suspends with `finishReason === 'suspended'`

#### Scenario: Approval card shows appointment count

- **WHEN** the approval card is rendered for `cancelAllAppointments`
- **THEN** the card SHALL display the number of appointments to cancel (e.g., "5 Termine stornieren?")
- **AND** the card SHALL show a scrollable list of appointment summaries
- **AND** the card SHALL use danger/warning styling

#### Scenario: Customer approves mass cancellation

- **WHEN** the customer approves `cancelAllAppointments`
- **THEN** all future appointments for the customer are cancelled
- **AND** the customer sees a summary of cancelled, failed, and skipped counts
