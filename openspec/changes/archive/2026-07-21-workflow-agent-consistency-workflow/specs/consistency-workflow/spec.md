## ADDED Requirements

### Requirement: Consistency workflow runs after every user question

After the admin confirms they are done viewing the grid (by clicking "Ready" in ask_user), or after the admin's requested action executes, the system SHALL trigger a Mastra Workflow that runs consistency checks in parallel and returns combined results.

The workflow SHALL use `.parallel()` for extensibility — each check is an independent step.

The workflow SHALL be triggered by a single agent tool `run_consistency_checks`.

#### Scenario: Consistency checks run after Ready
- **WHEN** admin clicks "Ready" in ask_user after viewing the grid
- **THEN** agent calls `run_consistency_checks`
- **AND** the workflow runs all parallel steps
- **AND** returns combined results to the agent

#### Scenario: Consistency checks run after action execution
- **WHEN** admin clicks an action option (e.g., "Lock user 5") in ask_user
- **THEN** agent executes the action first
- **AND** then calls `run_consistency_checks`
- **AND** returns combined results to the agent

#### Scenario: New checks added without restructuring
- **WHEN** a new consistency check is added
- **THEN** a new step is added to the `.parallel()` array
- **AND** no other code changes are needed
