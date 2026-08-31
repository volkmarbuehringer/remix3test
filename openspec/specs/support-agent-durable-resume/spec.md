# support-agent-durable-resume Specification

## Purpose

Makes the support-agent chat durable: a pending tool approval or an `ask_user` confirm gate survives a page reload, a browser change, or a server restart, and is re-surfaced to the admin so it can be resumed instead of lost.

## Requirements

### Requirement: Pending gate state is durably indexed per admin

The system SHALL persist a per-admin pointer to the support agent's currently pending gate in Postgres, so the suspended run can be located after a page reload, a browser change, or a server restart without relying on process memory or client-side state.

#### Scenario: A started support run is indexed to the admin

- **WHEN** the support agent starts a run that will suspend on a tool decision or a question
- **THEN** the system SHALL record the run id, thread id, and running status keyed to that admin user
- **AND** the record SHALL survive a server restart

#### Scenario: A suspended run records its gate payload

- **WHEN** the support agent's run suspends on a tool decision or an `ask_user` gate
- **THEN** the system SHALL update the admin's index record with the suspended status, the tool call id, the tool name, the arguments, and the frozen suspend payload

#### Scenario: A completed run clears the index

- **WHEN** the support run finishes, errors, or is cancelled
- **THEN** the system SHALL remove the admin's index record so it no longer surfaces on reconnect

#### Scenario: A new run replaces a stale one

- **WHEN** an admin starts a new support run while a previous run is still pending
- **THEN** the index record SHALL point to the new run, and completion of the previous run SHALL NOT clear the new run's record

### Requirement: Reconnect surfaces a suspended gate

The system SHALL expose a non-mutating surface that, for the authenticated admin, returns the support agent's pending gate and its payload, or an explicit none state when no pending gate exists.

#### Scenario: A pending gate is returned on reconnect

- **WHEN** an admin requests the reconnect surface while a support run is suspended
- **THEN** the system SHALL return the run id, thread id, tool call id, tool name, args, and the gate type (tool decision or question) with its payload

#### Scenario: No pending gate returns none

- **WHEN** an admin requests the reconnect surface with no indexed pending gate
- **THEN** the system SHALL return a none state

#### Scenario: A stale index is cleared on reconnect

- **WHEN** the indexed run no longer exists or is no longer pending in run storage (for example, resumed in another browser)
- **THEN** the system SHALL clear the index and return a none state

### Requirement: Reconnect is authenticated and non-mutating

The reconnect surface SHALL require an authenticated admin and SHALL NOT resume or otherwise mutate the support run; it only reads the suspended state.

#### Scenario: Unauthenticated reconnect is rejected

- **WHEN** an unauthenticated user requests the reconnect surface
- **THEN** the system SHALL reject the request (401) and SHALL NOT expose any pending gate

#### Scenario: Reconnect does not resume the run

- **WHEN** an admin requests the reconnect surface for a pending gate
- **THEN** the support run SHALL remain suspended and SHALL NOT execute further steps

### Requirement: Client re-renders the pending gate on load

The support-agent page SHALL check for a pending gate on load and, when one exists, re-render it so the admin can resume the pending decision or question.

#### Scenario: Pending gate renders on page load

- **WHEN** the support-agent page loads and the reconnect surface returns a pending gate
- **THEN** the page SHALL render the pending tool decision or question with its payload
- **AND** approving/declining or answering SHALL resume the run with that run id

#### Scenario: No pending gate leaves the page idle

- **WHEN** the support-agent page loads and the reconnect surface returns a none state
- **THEN** the page SHALL remain idle with no pending gate rendered

### Requirement: Resume resolves the run from durable state

The system SHALL resolve the suspended run for an approve/decline/answer request from the durable per-admin index when the run id is not otherwise determinable, so a pending gate can be resumed after a server restart.

#### Scenario: Resume uses the indexed run

- **WHEN** a resume request carries no run id determinable from process memory and the index record exists
- **THEN** the system SHALL resolve the run id, tool call id, and thread id from the admin's durable index record
- **AND** resume the run only when the record exists

#### Scenario: Resume without an index record fails cleanly

- **WHEN** a resume request cannot be resolved from the durable index
- **THEN** the system SHALL return an error response and SHALL NOT resume any run
