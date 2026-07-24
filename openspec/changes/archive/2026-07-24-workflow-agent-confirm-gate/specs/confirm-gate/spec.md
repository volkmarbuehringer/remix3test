## ADDED Requirements

### Requirement: lookup_user tool provides read-only user lookup

The system SHALL provide a `lookup_user` tool that searches for users by query and returns preflight data without executing any action.

#### Scenario: lookup_user returns matching users with preflight data

- **WHEN** `lookup_user` is called with `{ query: "John Doe" }`
- **THEN** the tool SHALL return `{ found: true, users: [...] }`
- **AND** each user object SHALL include `id`, `name`, `email`, `role`, `disabledAt`, and `pendingCount`
- **AND** the result SHALL include `totalPending`, `lockedUsers`, `lockedTotal`, `activeUsers`, and `activeTotal`

#### Scenario: lookup_user returns not found

- **WHEN** `lookup_user` is called with a query that matches no users
- **THEN** the tool SHALL return `{ found: false, users: [] }`
- **AND** SHALL NOT throw or error

#### Scenario: lookup_user has no destructive side effects

- **WHEN** `lookup_user` executes
- **THEN** the tool SHALL NOT modify any database rows
- **AND** SHALL NOT create audit log entries
- **AND** SHALL NOT require admin approval (`requireApproval: false`)

### Requirement: Execute tools remove confirmed flag

The `cancel_user_workflow_v2`, `lock_user_workflow_v2`, and `unlock_user_workflow_v2` tools SHALL remove the `confirmed` parameter. Each tool SHALL have exactly one mode: execution.

#### Scenario: cancel_user_workflow_v2 has no confirmed parameter

- **WHEN** `cancel_user_workflow_v2` input schema is defined
- **THEN** the schema SHALL NOT include a `confirmed` field
- **AND** the tool SHALL always execute the cancellation workflow

#### Scenario: lock_user_workflow_v2 has no confirmed parameter

- **WHEN** `lock_user_workflow_v2` input schema is defined
- **THEN** the schema SHALL NOT include a `confirmed` field
- **AND** the tool SHALL always execute the lock workflow

#### Scenario: unlock_user_workflow_v2 has no confirmed parameter

- **WHEN** `unlock_user_workflow_v2` input schema is defined
- **THEN** the schema SHALL NOT include a `confirmed` field
- **AND** the tool SHALL always execute the unlock workflow

#### Scenario: cancel_user_workflow_v2 requires deleteAppointments

- **WHEN** `cancel_user_workflow_v2` is called
- **THEN** `deleteAppointments` SHALL be a required parameter
- **AND** the agent SHALL provide an explicit boolean value based on admin context

### Requirement: Confirm gate protocol replaces two-phase pattern

The workflow agent instructions SHALL specify a three-phase protocol for user management actions: Lookup + Navigate → Confirm Gate → Execute.

#### Scenario: Flow proceeds after admin confirms

- **WHEN** the admin selects "Bestätigen" in the ask_user gate
- **THEN** the agent SHALL call the appropriate execute tool (`cancel_user_workflow_v2`, `lock_user_workflow_v2`, or `unlock_user_workflow_v2`)
- **AND** SHALL pass the `targetUserId` from the earlier `lookup_user` result

#### Scenario: Flow cancels on admin abort

- **WHEN** the admin selects "Abbrechen" in the ask_user gate
- **THEN** the agent SHALL NOT call any execute tool
- **AND** SHALL return a text message confirming the action was cancelled

#### Scenario: Agent navigates before ask_user

- **WHEN** the agent follows the user management protocol
- **THEN** `navigate()` SHALL be called before `ask_user()`
- **AND** SHALL use the filter parameter matching the search query

#### Scenario: Agent uses lookup_user before navigate

- **WHEN** the admin requests a lock, cancel, or unlock action
- **THEN** the agent SHALL call `lookup_user` first
- **AND** SHALL use the returned user data to determine the target

#### Scenario: Consistency data from lookup_user is used in report

- **WHEN** the agent calls `generate_action_report` after execution
- **THEN** the consistency check data (`lockedUsers`, `lockedTotal`, `activeUsers`, `activeTotal`) SHALL be taken from the `lookup_user` output
- **AND** the agent SHALL NOT make a separate consistency check call

## MODIFIED Requirements

### Requirement: Preflight workflow assembles user data in parallel

The system SHALL provide a `userPreflightWorkflow` Mastra Workflow that takes a `targetUserId` and `adminUserId` and returns the target user's profile, pending appointment count, and system-wide consistency check results, all computed in parallel.

(Behavior unchanged. The preflight workflow continues to serve as the backing implementation for the new `lookup_user` tool.)

#### Scenario: Preflight returns user profile with pending count

- **WHEN** `userPreflightWorkflow` is called with a valid `targetUserId`
- **THEN** the output SHALL include `found: true`
- **AND** the output SHALL include `user` object with `id`, `name`, `email`, `role`, and `disabledAt` (null if active)
- **AND** the output SHALL include `pendingCount` (number of future appointments for this user)

#### Scenario: Preflight returns system consistency data

- **WHEN** `userPreflightWorkflow` is called with any valid `targetUserId`
- **THEN** the output SHALL include `lockedUsers` (array of users with `id`, `name`, `email`, `pendingCount`)
- **AND** the output SHALL include `lockedTotal` (sum of pendingCount across locked users)
- **AND** the output SHALL include `activeUsers` (array of users with `id`, `name`, `email`, `pendingCount`)
- **AND** the output SHALL include `activeTotal` (sum of pendingCount across active users)

#### Scenario: Preflight returns error for unknown user

- **WHEN** `userPreflightWorkflow` is called with a `targetUserId` that does not exist
- **THEN** the output SHALL include `found: false`
- **AND** the output SHALL include an `error` string

## REMOVED Requirements

### Requirement: Preflight workflow replaces separate check tools

**Reason**: The `confirmed=false`/`confirmed=true` pattern is replaced by the `lookup_user` tool + deduplicated execute tools. The `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, and `unlockUserWorkflow_v2` tools no longer have a preflight path.

**Migration**: Use `lookup_user` for preflight data. Execute tools now only support execution (no `confirmed` flag).

### Requirement: Consistency data available without separate tool call

**Reason**: This requirement is superseded by the `lookup_user` tool, which inherently returns consistency data alongside user lookup results.

**Migration**: Replace calls to `cancelUserWorkflow_v2(confirmed=false)` with `lookup_user(query)`. The same consistency data is available in the lookup result.
