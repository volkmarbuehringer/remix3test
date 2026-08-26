# admin-clients Specification

## Purpose

The /admin/clients admin page manages clients records in a paginated, sortable, filterable grid with full CRUD, status toggling, admin audit logging, and frame-aware validation re-renders — at the same feature level and conventions as the /admin/users page.

## Requirements

### Requirement: Clients grid is served at /admin/clients

The system SHALL serve the admin clients grid at the route `/admin/clients` (route key `clients`) to authenticated admin users, and SHALL NOT serve the grid at the previous singular path `/admin/client`.

#### Scenario: Admin requests the clients grid

- **WHEN** an authenticated admin requests `GET /admin/clients`
- **THEN** the system SHALL render the clients grid with rows, sorting, filtering, and pagination controls
- **AND** the response SHALL navigate only the `admin-content` frame

#### Scenario: Old singular path no longer serves the grid

- **WHEN** a request is made to the previous singular path `/admin/client`
- **THEN** the system SHALL NOT serve the clients grid at that path

### Requirement: Grid sorting, filtering, and pagination

The system SHALL render the clients grid with sortable columns (id, name, email, role, status, registered), a free-text filter that matches client name or email, pagination controls (previous/next), and a page size that respects the admin's session preference.

#### Scenario: Sort by name

- **WHEN** an admin follows the sort link for the `name` column
- **THEN** the grid SHALL re-sort rows by name
- **AND** the sort, filter, and pagination state SHALL be preserved

#### Scenario: Filter by search text

- **WHEN** an admin submits the search/filter form with a term
- **THEN** the grid SHALL display only clients whose name or email matches the term

#### Scenario: Page through the grid

- **WHEN** an admin follows the pagination link
- **THEN** the grid SHALL show the next or previous page of clients
- **AND** the sort and filter state SHALL be preserved

### Requirement: Status filter tabs and status column

The system SHALL render Status filter tabs (All, Active, Inactive) and a Status column that displays each client's status as a badge, mirroring the users admin page.

#### Scenario: Filter by status

- **WHEN** an admin selects a Status filter tab
- **THEN** the grid SHALL display only clients with that status
- **AND** the Status column SHALL render each row's status as a badge

### Requirement: Status toggle action with guards

The system SHALL provide a per-row enable/disable action that toggles a client's status, and SHALL refuse a toggle when a guard forbids it, surfacing the guard's reason and preserving grid state.

#### Scenario: Toggle a client status

- **WHEN** an admin activates the status toggle on a client
- **THEN** the system SHALL flip the client's status
- **AND** the grid SHALL re-render reflecting the new status
- **AND** the sort, filter, and pagination state SHALL be preserved

#### Scenario: Toggle refused by a guard

- **WHEN** the status toggle is forbidden by a guard
- **THEN** the system SHALL NOT change the client's status
- **AND** the system SHALL surface the guard's reason (for example, a flash message)
- **AND** the grid SHALL redirect back preserving the sort, filter, and pagination state

### Requirement: Admin audit logging

The system SHALL record an admin audit-log entry (actor admin id and email, action type, target type and id, and details) for each create, update, destroy, and status-toggle action performed on the clients grid.

#### Scenario: Create is audited

- **WHEN** an admin creates a client
- **THEN** the system SHALL record an audit-log entry with action type `create`, target type `clients`, and the created client id

#### Scenario: Status toggle is audited

- **WHEN** an admin toggles a client's status
- **THEN** the system SHALL record an audit-log entry with action type `update` and details indicating the new status

### Requirement: Validation failure re-renders with preserved state

On schema validation failure for the create or update action, the system SHALL re-render the clients page at status 200 with the submitted field values preserved, per-field error messages, and the current grid state (offset, sort, direction, filter) preserved, using the same grid-error rendering path as the users admin page.

#### Scenario: Create with invalid fields re-renders with preserved values

- **WHEN** an admin submits the create form with a field that fails validation
- **THEN** the system SHALL return status 200 with the clients page re-rendered
- **AND** the create panel SHALL remain visible with the submitted values preserved
- **AND** an error message SHALL be shown next to the invalid field

#### Scenario: Update with invalid fields re-renders with preserved values

- **WHEN** an admin submits the update form with a field that fails validation
- **THEN** the system SHALL return status 200 with the clients page re-rendered
- **AND** the edit panel SHALL remain visible with the submitted values preserved
- **AND** the current grid state SHALL be preserved

### Requirement: Row actions are server-rendered

Each per-row action (edit, enable/disable, delete) SHALL be a server-rendered form or link that navigates only the `admin-content` frame. A row action SHALL NOT perform a client-side data mutation via fetch/XHR, and a destructive row action SHALL confirm before submitting.

#### Scenario: Row action does not issue a client-side mutation request

- **WHEN** an admin triggers a row action on the clients grid
- **THEN** no fetch/XHR request to a JSON mutation endpoint is issued
- **AND** no client-side frame reload follows the action
- **AND** the action is submitted via the existing server-rendered form or link
