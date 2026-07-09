## ADDED Requirements

### Requirement: Admin identity SHALL be available in support agent tools

The system SHALL provide `runWithAdminId` and `requireAdminId` helpers using AsyncLocalStorage, matching the existing `runWithUserId` pattern in customer-tools.ts. The mastra chat controller SHALL wrap `agent.generate()` with `runWithAdminId(user.id, ...)` so that mutation tools can call `requireAdminId()` to get the authenticated admin's user ID.

#### Scenario: Tool retrieves admin ID during execution
- **WHEN** a mutation tool's `execute` function calls `requireAdminId()`
- **THEN** it returns the user ID of the admin who sent the current chat message
- **AND** the ID matches the authenticated user from the session

#### Scenario: Tool called outside admin context throws
- **WHEN** a mutation tool's `execute` function calls `requireAdminId()` outside of a `runWithAdminId` scope
- **THEN** it throws `"Not authenticated as admin"`

### Requirement: System SHALL prevent login for disabled accounts

The system SHALL add a `disabled_at BIGINT` column to the `users` table. Three auth paths SHALL reject disabled accounts:
1. Password login (`verifyCredentials`) SHALL return null when `user.disabled_at IS NOT NULL`
2. Session verify (auth scheme) SHALL return null when `user.disabled_at IS NOT NULL`
3. API token auth (`apiTokenAuth`) SHALL return a 401 response when `user.disabled_at IS NOT NULL`

The registration path SHALL remain unchanged — the email UNIQUE constraint and `findOne` check already prevent re-registration with the same email regardless of disabled status.

#### Scenario: Disabled user cannot log in with password
- **WHEN** a user with `disabled_at` set attempts to log in with correct email and password
- **THEN** the password provider returns null
- **AND** the user sees "Invalid email or password."

#### Scenario: Existing session is invalidated after disable
- **WHEN** an admin disables a user account (incrementing `token_version`)
- **THEN** any existing session for that user fails the auth scheme verify
- **AND** the user is redirected to the login page on their next request

#### Scenario: API token auth rejects disabled user
- **WHEN** a disabled user presents a valid (non-expired, non-revoked) API token
- **THEN** the `apiTokenAuth` middleware returns a 401 response with `"Account disabled"`
- **AND** the request is not forwarded to the route handler

#### Scenario: Disabled email cannot be re-registered
- **WHEN** someone attempts to register with the email of a disabled account
- **THEN** the registration controller finds the existing row
- **AND** returns "Ein Konto mit dieser E-Mail-Adresse existiert bereits."

### Requirement: Support agent SHALL provide a cancel_user_account tool

The support agent SHALL have a `cancel_user_account` tool that accepts a `targetUserId` (number). The tool SHALL:
- Resolve the admin identity via `requireAdminId()`
- Guard against self-cancellation (admin cannot cancel their own account)
- Delegate to the `cancelUserWorkflow` for all business logic

#### Scenario: Admin cancels another user
- **WHEN** the support agent calls `cancel_user_account` with `targetUserId: 42`
- **THEN** the tool calls `requireAdminId()` to get the acting admin's user ID
- **AND** delegates to `executeCancelUserWorkflow` with the target and admin IDs

#### Scenario: Admin attempts to cancel own account
- **WHEN** the support agent calls `cancel_user_account` with `targetUserId` equal to the admin's own ID
- **THEN** the tool returns `{ success: false, error: "Cannot cancel your own account" }`

### Requirement: cancelUserWorkflow SHALL validate the target user

The first step of the workflow SHALL validate that the target user exists, is not an admin, and is not already disabled. If any check fails, the workflow SHALL return an error and skip remaining steps.

#### Scenario: Target user does not exist
- **WHEN** the workflow receives a non-existent `targetUserId`
- **THEN** step 1 returns `{ valid: false, error: "User not found" }`
- **AND** downstream steps skip execution
- **AND** the workflow output includes the error

#### Scenario: Target user is an admin
- **WHEN** the workflow receives a `targetUserId` whose role is `admin`
- **THEN** step 1 returns `{ valid: false, error: "Cannot cancel admin accounts" }`
- **AND** the workflow aborts

#### Scenario: Target user is already disabled
- **WHEN** the workflow receives a `targetUserId` whose `disabled_at` is not null
- **THEN** step 1 returns `{ valid: false, error: "Account already disabled" }`
- **AND** the workflow aborts

### Requirement: cancelUserWorkflow SHALL delete future appointments

The second step SHALL delete all appointments for the target user where `date > now` (epoch ms). Past appointments SHALL be preserved. The step SHALL return the count of deleted appointments.

#### Scenario: User has future appointments
- **WHEN** the target user has 3 appointments with future dates
- **THEN** the step executes `DELETE FROM appointments WHERE user_id = $1 AND date > $2`
- **AND** returns `deletedAppointments: 3`

#### Scenario: User has no future appointments
- **WHEN** the target user has no appointments with future dates
- **THEN** the step deletes 0 rows
- **AND** returns `deletedAppointments: 0`

### Requirement: cancelUserWorkflow SHALL disable the account

The third step SHALL `UPDATE users SET disabled_at = now, token_version = token_version + 1 WHERE id = $1 AND disabled_at IS NULL`. The step SHALL also revoke all outstanding API tokens for the user via `UPDATE api_tokens SET revoked_at = now WHERE user_id = $1 AND revoked_at IS NULL`. The `disabled_at IS NULL` guard makes the step idempotent.

#### Scenario: Account successfully disabled
- **WHEN** the target user has `disabled_at IS NULL`
- **THEN** the step updates the row and returns `disabled: true`

#### Scenario: Account already disabled (idempotent)
- **WHEN** the target user already has `disabled_at` set
- **THEN** the WHERE clause matches zero rows
- **AND** the step returns `disabled: false, error: "Account already disabled"`

### Requirement: cancelUserWorkflow SHALL write an audit log entry

The fourth step SHALL insert a row into `audit_logs` with the admin identity, action type `user_cancelled`, target type `user`, target ID, and a JSON details object containing the target email, target name, and deleted appointment count. Audit step failures SHALL be caught and logged without failing the workflow.

#### Scenario: Audit log written on successful cancellation
- **WHEN** the disable step succeeded
- **THEN** an audit_log row is inserted with `action_type = 'user_cancelled'`
- **AND** `details` includes `targetEmail`, `targetName`, and `deletedAppointments`

#### Scenario: Audit log write fails gracefully
- **WHEN** the `INSERT INTO audit_logs` query throws
- **THEN** the error is caught and logged
- **AND** the workflow continues (audit failure does not block cancellation)

### Requirement: cancelUserWorkflow SHALL notify the user (best-effort)

The fifth step SHALL attempt to send an account cancellation notification email to the target user. If sending fails, the notification SHALL be enqueued for retry. The step SHALL NOT fail the workflow if notification fails.

#### Scenario: Notification sent successfully
- **WHEN** the target user has an email address and the mailer sends successfully
- **THEN** the step returns `notificationSent: true`

#### Scenario: Notification fails
- **WHEN** `sendAccountDeletionEmail` throws
- **THEN** the error is caught
- **AND** a failed notification is enqueued
- **AND** the step returns `notificationSent: false`
- **AND** the workflow output still reports `success: true`

### Requirement: cancelUserWorkflow SHALL return a summary on completion

The workflow output SHALL include `success`, `targetUserId`, `deletedAppointments`, `auditLogged`, and optionally `error` and `notificationSent`.

#### Scenario: Successful cancellation
- **WHEN** all steps succeed
- **THEN** the workflow returns `{ success: true, targetUserId: 42, deletedAppointments: 3, notificationSent: true }`

#### Scenario: Validation failure
- **WHEN** step 1 fails validation
- **THEN** the workflow returns `{ success: false, targetUserId: 42, deletedAppointments: 0, error: "User not found" }`
