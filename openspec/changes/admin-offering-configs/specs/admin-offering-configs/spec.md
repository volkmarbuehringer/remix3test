## ADDED Requirements

### Requirement: Admin can list offering configs
The system SHALL provide a paginated, sortable, filterable list of all offering configs at `GET /admin/offering-configs`. The list SHALL display `id`, resource description, rules summary, `created_at`, and `updated_at` columns. The `rules` JSONB SHALL be displayed as a human-readable summary (e.g., "Mon 9:00-17:00, Wed 9:00-17:00"). Unauthenticated or non-admin requests SHALL be rejected with 401/403.

#### Scenario: Admin views offering config list
- **WHEN** an admin user navigates to `/admin/offering-configs`
- **THEN** the system displays a table with columns: ID, Resource, Rules, Created At, Updated At, and Actions

#### Scenario: Non-admin is denied
- **WHEN** a non-admin user navigates to `/admin/offering-configs`
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Admin sorts by column
- **WHEN** an admin clicks the "Resource" column header
- **THEN** the list is sorted alphabetically by resource description (ascending); clicking again reverses to descending

#### Scenario: Admin filters offering configs
- **WHEN** an admin types "resource1" in the search field and clicks "Search"
- **THEN** the list is filtered to only configs whose resource description contains "resource1" (case-insensitive)

#### Scenario: Admin paginates
- **WHEN** the config list has more than 15 items and the admin clicks "Weiter"
- **THEN** the next page of 15 configs is displayed

### Requirement: Admin can create an offering config
The system SHALL allow an admin to create a new offering config via POST to `/admin/offering-configs`. The form SHALL accept a `resource_id` (select from existing resources) and day-specific time ranges (start/end minutes per day of the week). Validation SHALL ensure resource_id is provided and the resource does not already have a config. On success the config is created and the page redirects to the list with the new config in edit mode.

#### Scenario: Successful offering config creation
- **WHEN** an admin selects resource "resource1" and sets Monday 9:00-17:00 and Wednesday 9:00-17:00
- **THEN** the config is created with rules `{ monday: [540, 1020], wednesday: [540, 1200] }` and the page redirects to `/admin/offering-configs?editing=<new-id>`

#### Scenario: Duplicate resource config on create
- **WHEN** an admin tries to create a config for a resource that already has one
- **THEN** the system returns a 400 error with message "Resource already has a config"

### Requirement: Admin can update an offering config
The system SHALL allow an admin to update an existing offering config via PUT to `/admin/offering-configs/:id`. The form SHALL allow modifying day-specific time ranges. On success the config is updated and the page redirects to the list preserving grid state.

#### Scenario: Successful offering config update
- **WHEN** an admin updates the config for resource to set Monday 8:00-18:00
- **THEN** the rules are updated and the page redirects back to the config list

#### Scenario: Invalid update ID
- **WHEN** an admin submits an update for a non-existent config ID
- **THEN** the system returns a 400 error

### Requirement: Admin can delete an offering config
The system SHALL allow an admin to delete an offering config via DELETE to `/admin/offering-configs/:id`. On success the config is removed and the page redirects to the list.

#### Scenario: Successful offering config deletion
- **WHEN** an admin clicks the delete button on an offering config row
- **THEN** the config is removed and the page redirects to the config list
