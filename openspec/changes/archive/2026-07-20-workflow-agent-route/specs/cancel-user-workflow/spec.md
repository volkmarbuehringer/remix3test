## ADDED Requirements

### Requirement: Reuse existing cancelUserWorkflow

The system SHALL reuse the existing `cancelUserWorkflow` from `workflow-executor.ts` as the execution step of `cancelUserWorkflow_v2`. The workflow itself SHALL NOT be modified.

#### Scenario: cancelUserWorkflow_v2 calls existing workflow
- **WHEN** the admin confirms both the user lock and appointment deletion
- **THEN** the tool SHALL call `executeCancelUserWorkflow` with `targetUserId`, `adminUserId`, `adminEmail`, and `deleteAppointments: true`

#### Scenario: cancelUserWorkflow is unchanged
- **WHEN** the existing `cancel_user_account` tool in `support-tools.ts` is triggered
- **THEN** it SHALL continue to call `executeCancelUserWorkflow` as before, without any changes

### Requirement: Existing cancelUserWorkflow behavior

The `cancelUserWorkflow` SHALL continue to execute these steps in order: validate target user, delete future appointments and disable account, write audit log, send notification.

#### Scenario: Successful cancellation
- **WHEN** `cancelUserWorkflow` runs with valid `targetUserId`, `adminUserId`, and `adminEmail`
- **THEN** the system SHALL delete all future appointments, set `disabled_at`, increment `token_version`, write an audit log entry, and attempt to send a notification
- **AND** return `success: true` with the count of deleted appointments

#### Scenario: Self-cancellation rejected
- **WHEN** `targetUserId` equals `adminUserId`
- **THEN** the workflow SHALL reject with error "Cannot cancel your own account"

#### Scenario: Admin account cancellation rejected
- **WHEN** the target user is an admin
- **THEN** the workflow SHALL reject with error "Cannot cancel admin accounts"

#### Scenario: Already disabled user returns success
- **WHEN** the target user is already disabled
- **THEN** the workflow SHALL return `success: false` with error "Account already disabled"
