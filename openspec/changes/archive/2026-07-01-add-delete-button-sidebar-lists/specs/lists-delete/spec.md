## ADDED Requirements

### Requirement: User can delete own list from sidebar
The system SHALL allow authenticated users to delete their own lists from the `/lists` page sidebar via a form-based POST request.

#### Scenario: Successful delete
- **WHEN** authenticated user submits a POST to `/lists/:id/delete` for their own list
- **THEN** the list is permanently deleted and the system redirects to `/lists`

#### Scenario: Delete non-existent list
- **WHEN** authenticated user submits a POST to `/lists/:id/delete` for a non-existent list ID
- **THEN** the system returns a 404 JSON error response

#### Scenario: Delete another user's list
- **WHEN** authenticated user submits a POST to `/lists/:id/delete` for a list owned by another user
- **THEN** the system returns a 404 JSON error response (list not found — user cannot discover other users' list IDs)

#### Scenario: Invalid list ID
- **WHEN** authenticated user submits a POST to `/lists/:id/delete` with a non-numeric or invalid ID
- **THEN** the system returns a 400 JSON error response

#### Scenario: Admin deletes any user's list
- **WHEN** an admin user submits a POST to `/lists/:id/delete` for any list
- **THEN** the list is permanently deleted (admin bypasses ownership check)

### Requirement: Delete button in sidebar
The system SHALL render a delete button next to each list entry in the `/lists` sidebar.

#### Scenario: Delete button visible per list
- **WHEN** the lists sidebar renders with one or more list entries
- **THEN** each list entry SHALL display a delete button

#### Scenario: Confirmation before delete
- **WHEN** user clicks the delete button
- **THEN** a confirmation dialog SHALL appear before the form is submitted
