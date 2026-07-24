# workflow-agent-preflight

## Requirements

### Requirement: Preflight workflow assembles user data in parallel

The system SHALL provide a `userPreflightWorkflow` Mastra Workflow that takes a `targetUserId` and `adminUserId` and returns the target user's profile, pending appointment count, and system-wide consistency check results, all computed in parallel.

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

#### Scenario: Preflight runs consistency checks in parallel

- **WHEN** `userPreflightWorkflow` executes
- **THEN** the locked users query and active users query SHALL run in parallel (not sequentially)
- **AND** both SHALL complete before the workflow returns

### Requirement: Preflight workflow replaces separate check tools

The `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, and `unlockUserWorkflow_v2` tools SHALL use `userPreflightWorkflow` for their `confirmed=false` path instead of inline SQL queries.

#### Scenario: Confirmed=false calls preflight workflow

- **WHEN** `cancelUserWorkflow_v2` is called with `confirmed=false`
- **THEN** the tool SHALL call `userPreflightWorkflow` instead of running inline `db.exec`
- **AND** the tool SHALL return the full preflight output including user profile, pending count, and consistency data

#### Scenario: Confirmed=true unchanged

- **WHEN** `cancelUserWorkflow_v2` is called with `confirmed=true`
- **THEN** the tool SHALL behave identically to the current implementation — delegate to the execution workflow via `executeCancelUserWorkflow`

#### Scenario: Consistency data available without separate tool call

- **WHEN** the agent calls `cancelUserWorkflow_v2` with `confirmed=false`
- **THEN** the returned preflight data SHALL include consistency check results
- **AND** the agent SHALL NOT need to call a separate `run_consistency_checks` tool to obtain this data

### Requirement: Consistency check steps are shared

The `checkLockedUsersPendingAppointments` and `checkActiveUsersPendingAppointments` steps from `consistencyCheckWorkflow` SHALL be exported and reused by `userPreflightWorkflow`, not duplicated.

#### Scenario: Steps imported from consistency check workflow

- **WHEN** `userPreflightWorkflow` runs its consistency check branches
- **THEN** the step implementations SHALL be the same imported functions used by `consistencyCheckWorkflow`
- **AND** changes to the consistency check queries SHALL automatically apply to both workflows
