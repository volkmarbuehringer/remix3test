## ADDED Requirements

### Requirement: Unified query flow without mode distinction

The workflow agent SHALL handle all user questions with a single flow: navigate to the users grid, ask_user with a "Ready" option, then run consistency checks. There SHALL be no separate query mode and workflow mode.

The ask_user options SHALL include:
- A "Ready" / "Fertig" baseline option (always present)
- Any action implied by the admin's request (e.g., "Lock user 5")

#### Scenario: Simple user query
- **WHEN** admin asks "which users are locked"
- **THEN** agent navigates to `/admin/users?filter=disabled`
- **THEN** agent calls `ask_user` with `[{ label: "Ready" }]`
- **WHEN** admin clicks Ready
- **THEN** agent runs consistency checks and reports results
- **THEN** agent waits for next question

#### Scenario: Workflow action
- **WHEN** admin asks "lock user 5"
- **THEN** agent navigates to `/admin/users?filter=5`
- **THEN** agent calls `ask_user` with `[{ label: "Lock user 5" }, { label: "Ready" }]`
- **WHEN** admin clicks "Lock user 5"
- **THEN** agent executes the lock workflow
- **THEN** agent runs consistency checks and reports results
- **THEN** agent waits for next question

#### Scenario: Consistency checks do not run for non-user questions
- **WHEN** admin asks a question unrelated to users
- **THEN** agent does NOT run the consistency workflow
- **AND** responds normally
