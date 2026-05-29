## ADDED Requirements

### Requirement: Admin can list resources
The system SHALL provide a paginated, sortable, filterable list of all resources at `GET /admin/resources`. The list SHALL display `id`, `description`, `created_at`, and `updated_at` columns. Unauthenticated or non-admin requests SHALL be rejected with 401/403.

#### Scenario: Admin views resource list
- **WHEN** an admin user navigates to `/admin/resources`
- **THEN** the system displays a table with columns: ID, Description, Created At, Updated At, and Actions

#### Scenario: Non-admin is denied
- **WHEN** a non-admin user navigates to `/admin/resources`
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Admin sorts by description
- **WHEN** an admin clicks the "Description" column header
- **THEN** the list is sorted alphabetically by description (ascending); clicking again reverses to descending

#### Scenario: Admin filters resources
- **WHEN** an admin types "resource1" in the search field and clicks "Search"
- **THEN** the list is filtered to only resources whose description contains "resource1" (case-insensitive)

#### Scenario: Admin paginates
- **WHEN** the resource list has more than 15 items and the admin clicks "Weiter"
- **THEN** the next page of 15 resources is displayed

### Requirement: Admin can create a resource
The system SHALL allow an admin to create a new resource via POST to `/admin/resources`. The form SHALL accept `description`. Validation SHALL ensure description is non-empty. On success the resource is created and the page redirects to the resource list with the new resource in edit mode.

#### Scenario: Successful resource creation
- **WHEN** an admin submits the create form with description "Meeting Room A"
- **THEN** the resource is created in the database and the page redirects to `/admin/resources?editing=<new-id>`

#### Scenario: Empty description on create
- **WHEN** an admin submits the create form with an empty description
- **THEN** the system returns a 400 error with message "Description is required"

### Requirement: Admin can edit a resource
The system SHALL allow an admin to update a resource via PUT to `/admin/resources/:id`. The inline editor SHALL load the resource's data into an editable form. The form SHALL support modifying the `description` field.

#### Scenario: Successful resource edit
- **WHEN** an admin clicks the edit button on a resource row, changes the description, and submits
- **THEN** the resource's description is updated and the page redirects to `/admin/resources` preserving grid state

### Requirement: Admin can delete a resource
The system SHALL allow an admin to delete a resource via DELETE to `/admin/resources/:id`. The action SHALL return a 302 redirect preserving grid state. If the resource is referenced by existing appointments, the delete SHALL fail with a referential integrity error.

#### Scenario: Successful resource deletion
- **WHEN** an admin clicks the delete button on a resource row that has no appointments
- **THEN** the resource is removed from the database and the page redirects to `/admin/resources` preserving grid state

#### Scenario: Delete resource with appointments
- **WHEN** an admin tries to delete a resource that has existing appointments
- **THEN** the system returns a 400 error indicating the resource cannot be deleted because it is in use

#### Scenario: Delete non-existent resource
- **WHEN** an admin sends DELETE to `/admin/resources/99999`
- **THEN** the system returns a 404 error with message "Resource not found"
