# agent-events-confirm-execute Specification

## Purpose

Defines how the agent-events admin pipeline obtains and acts on admin confirmation for destructive user actions via a durable, resumable workflow suspension, plus how the pipeline hands actionable intents to the workflow run.

## Requirements

### Requirement: Actionable intents confirm via a durable workflow suspension
The system SHALL confirm an actionable user-management intent (cancel, lock, unlock) by suspending the workflow run so admin approval is durable across process restarts, rather than storing confirmation state in process memory.

#### Scenario: Actionable intent opens a durable confirm gate
- **WHEN** an admin submits a message classified as `cancel-user`, `lock-user`, or `unlock-user`
- **THEN** the system SHALL start the user-management workflow, suspend it at the confirm gate, and expose a confirm prompt to the admin
- **AND** the suspension SHALL be persisted so the run can be resumed after a process restart

#### Scenario: Non-actionable intent does not suspend
- **WHEN** an admin submits a message classified as `show-appointments`
- **THEN** the system SHALL navigate to the appointments page without starting or suspending a workflow run

### Requirement: Confirm gate surfaces preflight context
The confirm prompt SHALL present preflight data about the target user obtained during workflow start, including name and pending/locked/active counts, instead of a bare action summary.

#### Scenario: Confirm prompt includes preflight data
- **WHEN** the confirm gate is shown for an actionable intent
- **THEN** the prompt SHALL include the target user's name and the pending, locked, and active counts gathered by the preflight step

### Requirement: Resume re-attaches to the suspended run
The system SHALL resume a suspended agent-events workflow by run id and re-attach to the already-persisted run, so execution continues from the suspension point rather than restarting the pipeline.

#### Scenario: Admin confirms a suspended run
- **WHEN** an admin selects confirm on a suspended run
- **THEN** the system SHALL resume the run identified by its run id with the confirmed flag and continue execution from the suspended step

#### Scenario: Admin cancels a suspended run
- **WHEN** an admin selects cancel on a suspended run
- **THEN** the system SHALL resume the run with a cancelled flag and end the action without executing the mutation

#### Scenario: Resume rejects an unknown or expired run
- **WHEN** a resume request references a run id that does not correspond to a suspended run
- **THEN** the system SHALL return an error response rather than executing an action

### Requirement: Event pipeline reports the run id as the durable handle
The event pipeline SHALL emit the workflow run id to the client for a started actionable intent, and the client SHALL use that run id when submitting confirmation, so the confirm hand-off is keyed to the persisted run rather than to a synthetic in-memory token.

#### Scenario: Client receives a run id on start
- **WHEN** the system starts a user-management workflow for an actionable intent
- **THEN** the event stream SHALL provide the workflow run id to the client
- **AND** the client SHALL post that run id back on confirm or cancel
