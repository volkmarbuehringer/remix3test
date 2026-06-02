## Purpose

The Nutzer user management page is accessible at the top-level path `/nutzer`, rendered in the standard `Layout`, with a direct link in the main navigation bar for admin users.

## Requirements

### Requirement: Nutzer page accessible at /nutzer

The system SHALL serve the Nutzer user management page at the top-level path `/nutzer`, accessible to authenticated admin users.

#### Scenario: Admin accesses /nutzer

- **WHEN** an authenticated admin user navigates to `/nutzer`
- **THEN** the system SHALL render the Nutzer management page with the table grid, filter bar, and pagination
- **AND** the response SHALL have status 200

#### Scenario: Non-admin is rejected from /nutzer

- **WHEN** an authenticated non-admin user navigates to `/nutzer`
- **THEN** the system SHALL return a 403 or redirect away

#### Scenario: Unauthenticated user is redirected from /nutzer

- **WHEN** an unauthenticated user navigates to `/nutzer`
- **THEN** the system SHALL redirect to the login page

### Requirement: Nutzer page renders in main Layout

The system SHALL render the Nutzer page via the standard `Layout` component (with MainNav, breadcrumbs, and footer), not the admin frame sidebar layout.

#### Scenario: Nutzer page shows main navigation

- **WHEN** the Nutzer page at `/nutzer` is rendered
- **THEN** the MainNav bar SHALL be visible at the top
- **AND** the breadcrumbs SHALL show a path including "Nutzer"
- **AND** no admin sidebar SHALL be visible

### Requirement: Nutzer link in main navigation bar

The system SHALL include a "Nutzer" link in the main navigation bar (`NAV_SECTIONS`) pointing to `/nutzer`, visible only to admin users.

#### Scenario: Admin user sees Nutzer nav link

- **WHEN** an admin user loads any page
- **THEN** the main navigation bar SHALL contain a link labeled "Nutzer" with href `/nutzer`

#### Scenario: Non-admin user does not see Nutzer nav link

- **WHEN** a non-admin user loads any page
- **THEN** the main navigation bar SHALL NOT contain a "Nutzer" link

### Requirement: Nutzer removed from admin sidebar

The system SHALL remove the "Nutzer" item from the admin sidebar navigation groups.

#### Scenario: Admin sidebar no longer shows Nutzer

- **WHEN** an admin user navigates to `/admin`
- **THEN** the admin sidebar SHALL NOT contain a "Nutzer" entry

### Requirement: Nutzer CRUD endpoints at /nutzer paths

The system SHALL serve all existing Nutzer CRUD and action endpoints at `/nutzer/*` paths instead of `/admin/nutzer/*`.

#### Scenario: GET /nutzer returns nutzer page

- **WHEN** an admin makes a GET request to `/nutzer`
- **THEN** the system SHALL return the nutzer table with the current page of results

#### Scenario: POST /nutzer creates a new user

- **WHEN** an admin makes a POST request to `/nutzer` with valid form data
- **THEN** the system SHALL create a new login and nutzer row and redirect to `/nutzer?editing=<newId>`

#### Scenario: PUT /nutzer/:id updates a user

- **WHEN** an admin makes a PUT request to `/nutzer/5` with valid form data
- **THEN** the system SHALL update the nutzer and login rows for ID 5

#### Scenario: DELETE /nutzer/:id deletes a user

- **WHEN** an admin makes a DELETE request to `/nutzer/5`
- **THEN** the system SHALL delete the nutzer and login rows for ID 5

#### Scenario: POST /nutzer/:id/reset-password resets password

- **WHEN** an admin makes a POST request to `/nutzer/5/reset-password`
- **THEN** the system SHALL reset the password for user ID 5 and return JSON

#### Scenario: POST /nutzer/:id/toggle-lock toggles lock

- **WHEN** an admin makes a POST request to `/nutzer/5/toggle-lock` with `{ "locked": true }`
- **THEN** the system SHALL toggle the lock state for user ID 5

#### Scenario: POST /nutzer/:id/toggle-active toggles active

- **WHEN** an admin makes a POST request to `/nutzer/5/toggle-active` with `{ "active": true }`
- **THEN** the system SHALL toggle the active state for user ID 5

### Requirement: Full-page navigation without frames

The system SHALL use standard anchor links for sort, filter, and pagination on the Nutzer page, not frame-targeted navigation.

#### Scenario: Clicking a sort column performs full page load

- **WHEN** a user clicks a sortable column header on the Nutzer table
- **THEN** the browser SHALL perform a full page navigation to the sorted URL
- **AND** the new page SHALL render with the updated sort order
