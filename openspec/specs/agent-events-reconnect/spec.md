# agent-events-reconnect Specification

## Purpose

Defines how the agent-events admin pipeline re-attaches to a suspended workflow run after a page reload, browser change, or server restart, re-surfacing the durable confirm gate to the admin so a pending action can be confirmed or cancelled.

## Requirements

### Requirement: Active runs are durably indexed per admin

The system SHALL persist a per-admin pointer to the currently active workflow run in Postgres, so the run can be located after a page reload, a browser change, or a server restart without relying on process memory or client-side state.

#### Scenario: A started workflow run is indexed to the admin

- **WHEN** the system starts a workflow run for an actionable intent from an admin
- **THEN** the system SHALL record the run id, workflow id, and running status keyed to that admin user
- **AND** the record SHALL survive a server restart

#### Scenario: A suspended run records its gate payload

- **WHEN** the workflow run suspends at the confirm gate
- **THEN** the system SHALL update the admin's active-run record with the suspended status, the suspending step id, and the frozen suspend payload

#### Scenario: A completed run clears the index

- **WHEN** the workflow run finishes, errors, or is cancelled
- **THEN** the system SHALL remove the admin's active-run record so it no longer surfaces on reconnect

#### Scenario: A new run replaces a stale one

- **WHEN** an admin starts a new workflow run while a previous run is still suspended
- **THEN** the active-run record SHALL point to the new run, and completion of the previous run SHALL NOT clear the new run's record

### Requirement: Reconnect surfaces a suspended run

The system SHALL expose an endpoint that, for the authenticated admin, returns the suspended workflow run and its confirm-gate payload, or an explicit none state when no suspended run exists.

#### Scenario: A suspended run is returned on reconnect

- **WHEN** an admin requests the reconnect endpoint while their indexed run is suspended
- **THEN** the system SHALL return the run id, workflow id, suspending step id, and suspend payload

#### Scenario: No active run returns none

- **WHEN** an admin requests the reconnect endpoint with no indexed run
- **THEN** the system SHALL return a none state

#### Scenario: A stale index is cleared on reconnect

- **WHEN** the indexed run no longer exists or is no longer suspended in workflow storage (for example, resumed in another browser)
- **THEN** the system SHALL clear the index and return a none state

### Requirement: Reconnect is authenticated and non-mutating

The reconnect endpoint SHALL require an authenticated admin and SHALL NOT resume or otherwise mutate the workflow run; it only reads the suspended state.

#### Scenario: Unauthenticated reconnect is rejected

- **WHEN** an unauthenticated user requests the reconnect endpoint
- **THEN** the system SHALL redirect to the login page

#### Scenario: Reconnect does not resume the run

- **WHEN** an admin requests the reconnect endpoint for a suspended run
- **THEN** the run SHALL remain suspended and SHALL NOT execute further steps

### Requirement: Client re-renders the confirm gate on reconnect

The agent-events page SHALL check for a suspended run on load and, when one exists, re-render the confirm gate so the admin can confirm or cancel the pending action.

#### Scenario: Suspended run renders the gate on page load

- **WHEN** the agent-events page loads and the reconnect endpoint returns a suspended run
- **THEN** the page SHALL display the confirm gate with the returned suspend payload
- **AND** confirming or cancelling SHALL resume the run with that run id

#### Scenario: No suspended run leaves the page idle

- **WHEN** the agent-events page loads and the reconnect endpoint returns a none state
- **THEN** the page SHALL remain in its idle state without a confirm gate

### Requirement: Resume resolves the workflow after restart

The system SHALL resolve the workflow id for a resume request from the durable admin run index when it is not otherwise determinable, so a suspended run can be resumed after a server restart.

#### Scenario: Resume uses the indexed workflow id

- **WHEN** a resume request carries no workflow id and the run id is not in process memory
- **THEN** the system SHALL resolve the workflow id from the admin's durable active-run record
- **AND** resume the run only when the record exists