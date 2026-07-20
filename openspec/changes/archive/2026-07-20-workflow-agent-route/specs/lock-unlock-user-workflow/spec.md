## ADDED Requirements

### Requirement: lockUserWorkflow

The system SHALL provide a `lockUserWorkflow` Mastra workflow that prevents a user from logging in by setting `disabled_at`, without deleting appointments or sending notifications.

#### Scenario: Successful lock
- **WHEN** `lockUserWorkflow` runs with valid `targetUserId` and `adminUserId`
- **THEN** the system SHALL set `disabled_at` to the current timestamp for that user
- **AND** write an audit log entry with action type `lock`
- **AND** return `success: true`

#### Scenario: Self-lock rejected
- **WHEN** `targetUserId` equals `adminUserId`
- **THEN** the workflow SHALL reject with error "Cannot lock your own account"

#### Scenario: Already locked user returns success
- **WHEN** the target user's `disabled_at` is already set
- **THEN** the workflow SHALL return `success: true` with message "User account is already locked"

#### Scenario: Non-existent user returns error
- **WHEN** the target user ID doesn't exist
- **THEN** the workflow SHALL return `success: false` with error "User not found"

### Requirement: unlockUserWorkflow

The system SHALL provide an `unlockUserWorkflow` Mastra workflow that re-enables a locked user by clearing `disabled_at` and incrementing `token_version` to invalidate existing sessions.

#### Scenario: Successful unlock
- **WHEN** `unlockUserWorkflow` runs with valid `targetUserId` and `adminUserId`
- **THEN** the system SHALL clear `disabled_at`, increment `token_version`
- **AND** write an audit log entry with action type `unlock`
- **AND** return `success: true`

#### Scenario: Self-unlock rejected
- **WHEN** `targetUserId` equals `adminUserId`
- **THEN** the workflow SHALL reject with error "Cannot unlock your own account"

#### Scenario: Already active user returns success
- **WHEN** the target user's `disabled_at` is already null
- **THEN** the workflow SHALL return `success: true` with message "User account is already active"

#### Scenario: Non-existent user returns error
- **WHEN** the target user ID doesn't exist
- **THEN** the workflow SHALL return `success: false` with error "User not found"
