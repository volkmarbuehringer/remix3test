## ADDED Requirements

### Requirement: Admin action button with confirmation

The system SHALL provide a client-entry component (`AdminActionButton`) that renders a button which triggers a confirmation dialog before performing a destructive action via a fetch request.

#### Scenario: Click with confirmation
- **WHEN** a user clicks the button and confirms the dialog
- **THEN** the system SHALL POST the parent form's data to the specified action URL and trigger a frame reload

#### Scenario: Click without confirmation
- **WHEN** no `confirmMsg` prop is provided
- **THEN** the button SHALL perform the action immediately without a confirmation dialog

#### Scenario: Cancel confirmation
- **WHEN** a user clicks the button but cancels the confirmation dialog
- **THEN** the system SHALL NOT perform the action

#### Scenario: Loading state during action
- **WHEN** the action is in progress (fetch pending)
- **THEN** the button SHALL display the `pendingLabel` text and SHALL be disabled

#### Scenario: Accessible action
- **WHEN** the button is rendered with `confirmMsg`
- **THEN** it SHALL use the `danger` tone to visually indicate a destructive action
