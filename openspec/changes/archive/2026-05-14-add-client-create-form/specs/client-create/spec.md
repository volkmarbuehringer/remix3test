## ADDED Requirements

### Requirement: Client route tree includes a POST create route

The client route tree SHALL include a `create` action mapped to `post('/')`.

#### Scenario: POST /client maps to create action
- **WHEN** a POST request arrives at `/client`
- **THEN** the controller SHALL invoke the `create` action

#### Scenario: GET /client still maps to index
- **WHEN** a GET request arrives at `/client`
- **THEN** the controller SHALL invoke the `index` action (unchanged)

### Requirement: Index action supports ?creating=true

The index action SHALL detect the `creating` query parameter. When present, it SHALL render a blank create form in the edit column alongside the grid.

#### Scenario: GET /client?creating=true renders create form
- **WHEN** a GET request arrives at `/client?creating=true`
- **THEN** the page SHALL render with a two-column layout
- **THEN** the right column SHALL contain a blank create form with empty fields

#### Scenario: GET /client without creating renders single-column grid
- **WHEN** a GET request arrives at `/client` without `creating=true`
- **THEN** the page SHALL render the grid in single-column layout (unchanged)

### Requirement: Create form submits to POST /client

The create form SHALL use `<RestfulForm method="POST" action="/client">` with fields for name, email, role, status, and registered date.

#### Scenario: Create form fields render empty
- **WHEN** the create form is rendered
- **THEN** the name input SHALL be empty
- **THEN** the email input SHALL be empty
- **THEN** the role select SHALL default to "Viewer"
- **THEN** the status select SHALL default to "Active"
- **THEN** the registered input SHALL show today's date

#### Scenario: Submit with valid data creates record
- **WHEN** the create form is submitted with valid name, email, role, status, and registered
- **THEN** the server SHALL insert a new row in the clients table
- **THEN** the server SHALL redirect to `/client?editing=<new-id>`

### Requirement: "Add New" button opens the create form

The client page SHALL display an "Add New" button when neither editing nor creating. Clicking it SHALL navigate to `/client?creating=true`.

#### Scenario: Button visible in default state
- **WHEN** the client page is rendered without `editing` or `creating` params
- **THEN** an "Add New" button SHALL be visible above the grid

#### Scenario: Button hidden during edit
- **WHEN** the client page is rendered with `?editing=N`
- **THEN** the "Add New" button SHALL NOT be visible

#### Scenario: Button hidden during create
- **WHEN** the client page is rendered with `?creating=true`
- **THEN** the "Add New" button SHALL NOT be visible
