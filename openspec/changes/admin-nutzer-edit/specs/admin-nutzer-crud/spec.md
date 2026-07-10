## ADDED Requirements

### Requirement: Admin can view nutzer grid

The system SHALL display a paginated, sortable, filterable grid of nutzer+login data at `/admin/nutzer`.

#### Scenario: Unauthenticated access

- **WHEN** an unauthenticated user requests `GET /admin/nutzer`
- **THEN** the system SHALL redirect to `/login?returnTo=/admin/nutzer`

#### Scenario: Non-admin access

- **WHEN** a non-admin authenticated user requests `GET /admin/nutzer`
- **THEN** the system SHALL return 403 Forbidden

#### Scenario: Admin views grid

- **WHEN** an admin user requests `GET /admin/nutzer`
- **THEN** the system SHALL return 200 with a table showing nutzer rows with columns: Vorname, Name, Email, Login, Verpfl, Aktiv, Gesp, Letzter Login

#### Scenario: Sort by column

- **WHEN** an admin requests `GET /admin/nutzer?sort=n_name&order=desc`
- **THEN** the system SHALL return rows ordered by `n_name` descending

#### Scenario: Filter by search term

- **WHEN** an admin requests `GET /admin/nutzer?filter=John`
- **THEN** the system SHALL return only rows where `n_vorname`, `n_name`, `n_email`, or `l_login` ILIKE `%John%`

#### Scenario: Pagination

- **WHEN** an admin requests `GET /admin/nutzer?offset=15`
- **THEN** the system SHALL return the next 15 rows starting from offset 15

### Requirement: Admin can edit a nutzer+login row

The system SHALL allow admins to edit all fields except `l_letzte_login` via an inline sidebar panel using two sequential UPDATE statements.

#### Scenario: Clicking Edit opens the edit panel

- **WHEN** an admin clicks "Edit" on a nutzer row
- **THEN** the system SHALL navigate to `/admin/nutzer?editing=N` and display an edit form panel beside the grid with fields pre-filled from that row

#### Scenario: Edit form contains all editable fields

- **WHEN** the edit panel is displayed
- **THEN** the form SHALL contain input fields for: Vorname, Name, Email, Verpflichtung (checkbox), Login, Aktiv (checkbox), Gesperrt (checkbox)

#### Scenario: Edit form does NOT contain letzte_login

- **WHEN** the edit panel is displayed
- **THEN** the form SHALL NOT include a field for `l_letzte_login`

#### Scenario: Successful update

- **WHEN** an admin submits the edit form with valid data
- **THEN** the system SHALL execute `UPDATE nutzer SET ... WHERE n_id=$1` AND `UPDATE login SET ... FROM nutzer WHERE login.l_id = nutzer.n_lid AND nutzer.n_id=$1`
- **AND** the system SHALL redirect back to `/admin/nutzer` and the grid SHALL reflect the changes

#### Scenario: Invalid data

- **WHEN** an admin submits the edit form with invalid data
- **THEN** the system SHALL return an appropriate error response

### Requirement: Admin can create a new nutzer+login pair

The system SHALL allow admins to create a new user with both nutzer and login data in a single operation.

#### Scenario: Clicking "Add New" opens the create panel

- **WHEN** an admin clicks "Add New" on the nutzer page
- **THEN** the system SHALL navigate to `/admin/nutzer?creating=true` and display a create form panel beside the grid

#### Scenario: Successful creation

- **WHEN** an admin submits the create form with valid data
- **THEN** the system SHALL first INSERT into `login`, then INSERT into `nutzer` with the new `l_id`
- **AND** the system SHALL redirect back to `/admin/nutzer` with the new row visible in the grid

### Requirement: Admin can delete a nutzer+login pair

The system SHALL allow admins to delete a user, removing both the nutzer and login rows.

#### Scenario: Delete with confirmation

- **WHEN** an admin clicks "Del" on a nutzer row
- **THEN** the system SHALL show a JavaScript confirmation dialog

#### Scenario: Confirmed deletion

- **WHEN** the admin confirms the deletion
- **THEN** the system SHALL DELETE from `nutzer` WHERE `n_id=$1`, then DELETE from `login` WHERE `l_id` matches the deleted nutzer's `n_lid`
- **AND** the grid SHALL refresh to reflect the deletion

### Requirement: Route wiring

The system SHALL wire all CRUD routes for the nutzer page.

#### Scenario: Routes are defined

- **WHEN** inspecting the route definitions
- **THEN** `adminRoutes.admin.nutzer` SHALL have `index`, `create`, `update`, and `destroy` routes

#### Scenario: Routes are mapped in router

- **WHEN** inspecting the router
- **THEN** all nutzer routes SHALL be mapped to `adminNutzerController` with `requireAuth` and `requireAdmin` middleware
