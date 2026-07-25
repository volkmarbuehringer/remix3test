## ADDED Requirements

### Requirement: Delete all upcoming appointments for a user on a specific resource

The workflow agent SHALL support deleting all upcoming appointments for a given user on a given resource, using a multi-step Mastra workflow with a confirmation gate.

The LLM SHALL return `{"type":"appointment","action":"delete-resource","targetQuery":"<user>","resourceQuery":"<resource>"}`. The controller SHALL resolve both the user (via `resolveTargetUser`) and the resource (by name or ID lookup) before starting the workflow.

If the user or resource cannot be resolved uniquely, the controller SHALL return an error message and stop.

The `deleteUserAppointmentsWorkflow` SHALL have 4 steps:

1. **preflight** — Looks up the user name, resource name, counts upcoming appointments, collects their dates
2. **confirm-gate** — Suspends the workflow with a payload showing the user name, resource name, and count of appointments to be deleted. The admin can confirm or cancel.
3. **execute** — Deletes all appointments for that user+resource combination where `date >= today`
4. **finalize** — Logs the admin action and returns success/failure

After the workflow completes (or is cancelled), the controller SHALL navigate to `/verwaltung/appointments` and trigger a frame reload.

#### Scenario: Successful deletion of a user's appointments on a resource

- **WHEN** the admin sends "delete all appointments for John in Raum A"
- **THEN** the LLM returns `{"type":"appointment","action":"delete-resource","targetQuery":"John","resourceQuery":"Raum A"}`
- **AND** the controller resolves John (user ID 42, email john@example.com) and "Raum A" (resource ID 3)
- **AND** the controller navigates to `/verwaltung/appointments?filter=john%40example.com`
- **AND** the controller starts `deleteUserAppointmentsWorkflow` with `{targetUserId:42, resourceId:3, adminUserId:...}`
- **AND** the preflight step finds 3 upcoming appointments
- **AND** the confirm-gate step suspends with payload showing "3 Termine von John in Raum A löschen?"
- **WHEN** the admin clicks "Bestätigen"
- **AND** the execute step deletes the 3 appointments
- **AND** the finalize step logs the admin action
- **THEN** the workflow completes successfully
- **AND** the frame reloads showing the appointments page without John's deleted appointments

#### Scenario: Resource not found

- **WHEN** the admin sends "delete appointments for John in NonExistentRoom"
- **AND** the resource lookup finds no match
- **THEN** the controller returns an SSE `message` event: "No resource found matching \"NonExistentRoom\""
- **AND** no workflow is started

#### Scenario: Admin cancels the deletion

- **WHEN** the confirm-gate is shown and the admin clicks "Abbrechen"
- **THEN** the workflow is cancelled
- **AND** the controller navigates to `/verwaltung/appointments`
- **AND** no appointments are deleted
