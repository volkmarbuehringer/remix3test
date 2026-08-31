## REMOVED Requirements

### Requirement: Delete all upcoming appointments for a user on a specific resource

**Reason**: The workflow-agent page is merged into the agent-events pipeline, which already implements the same delete flow via the `delete-appointments` intent and `deleteUserAppointmentsWorkflow` with a durable confirm gate.

**Migration**: Use `/admin/agent-events` and ask to delete appointments for a user on a resource (e.g. "delete all appointments for John in Raum A"). The behavior is specified in `agent-events-confirm-execute`.