## ADDED Requirements

### Requirement: Delete-appointments intent confirms via durable workflow suspension

The system SHALL confirm a delete-appointments intent (delete all upcoming appointments for a user on a resource) by suspending the `deleteUserAppointmentsWorkflow` at its confirm gate so approval is durable across process restarts, then resume the run by run id to execute or cancel the deletion.

#### Scenario: Delete-appointments intent opens a durable confirm gate

- **WHEN** an admin submits a message classified as `delete-appointments` with a resolvable target user and resource
- **THEN** the system SHALL start the `deleteUserAppointmentsWorkflow`, suspend it at the confirm gate, and expose a confirm prompt showing the target user, resource, and appointment count
- **AND** the suspension SHALL be persisted so the run can be resumed after a process restart

#### Scenario: Admin confirms the deletion

- **WHEN** an admin confirms a suspended delete-appointments run
- **THEN** the system SHALL resume the run by its run id and execute the deletion of the user's upcoming appointments on the resource

#### Scenario: Admin cancels the deletion

- **WHEN** an admin cancels a suspended delete-appointments run
- **THEN** the system SHALL resume the run with a cancelled flag and end the action without deleting appointments