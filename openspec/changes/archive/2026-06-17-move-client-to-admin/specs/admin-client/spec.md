## ADDED Requirements

### Requirement: Admin client management under `/admin/client`

The system SHALL provide an admin client management interface at `/admin/client` for administrators to manage client records (view, create, update, delete) within the admin sidebar layout.

#### Scenario: Admin navigates to /admin/client

- **WHEN** an authenticated admin user navigates to `/admin/client`
- **THEN** the system SHALL display the admin sidebar layout with the "Client-Test" nav item highlighted and the client grid as the main content area

#### Scenario: Non-admin user is redirected

- **WHEN** a non-admin authenticated user navigates to `/admin/client`
- **THEN** the system SHALL redirect the user away with an access denied response

#### Scenario: Unauthenticated user is redirected to login

- **WHEN** an unauthenticated user navigates to `/admin/client`
- **THEN** the system SHALL redirect the user to the login page

#### Scenario: Admin creates a new client record

- **WHEN** an admin submits a valid POST request to `/admin/client`
- **THEN** the system SHALL create a new client record and redirect to `/admin/client?editing=<newId>`

#### Scenario: Admin updates a client record

- **WHEN** an admin submits a valid PUT request to `/admin/client/:id`
- **THEN** the system SHALL update the client record and redirect to `/admin/client`

#### Scenario: Admin deletes a client record

- **WHEN** an admin submits a DELETE request to `/admin/client/:id`
- **THEN** the system SHALL delete the client record and redirect to `/admin/client/grid`

#### Scenario: Grid pagination uses admin frame

- **WHEN** an admin clicks pagination controls in the client grid
- **THEN** the system SHALL load paginated results within the admin-content frame

#### Scenario: Inline edit works under admin

- **WHEN** an admin clicks an email cell in the client grid to inline edit
- **THEN** the system SHALL send a PUT request to `/admin/client/:id` and update the cell inline
