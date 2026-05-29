## ADDED Requirements

### Requirement: Admin can list users
The system SHALL provide a paginated, sortable, filterable list of all users at `GET /admin/users`. The list SHALL display `id`, `name`, `email`, `role`, and `created_at` columns. The list SHALL exclude `password_hash` from the response. Unauthenticated or non-admin requests SHALL be rejected with 401/403.

#### Scenario: Admin views user list
- **WHEN** an admin user navigates to `/admin/users`
- **THEN** the system displays a table with columns: ID, Name, Email, Role, Created At, and Actions

#### Scenario: Non-admin is denied
- **WHEN** a non-admin user navigates to `/admin/users`
- **THEN** the system returns a 403 Forbidden response

#### Scenario: Admin sorts by column
- **WHEN** an admin clicks the "Name" column header
- **THEN** the list is sorted alphabetically by name (ascending); clicking again reverses to descending

#### Scenario: Admin filters users
- **WHEN** an admin types "john" in the search field and clicks "Search"
- **THEN** the list is filtered to only users whose name or email contains "john" (case-insensitive)

#### Scenario: Admin paginates
- **WHEN** the user list has more than 15 items and the admin clicks "Weiter"
- **THEN** the next page of 15 users is displayed

### Requirement: Admin can create a user
The system SHALL allow an admin to create a new user via POST to `/admin/users`. The form SHALL accept `name`, `email`, `role`, and `password`. Validation SHALL ensure name is non-empty, email is a valid format, password is at least 6 characters, and email is unique. On success the user is created and the page redirects to the user list with the new user in edit mode.

#### Scenario: Successful user creation
- **WHEN** an admin submits the create form with valid name "Jane Doe", email "jane@example.com", role "customer", and password "secret123"
- **THEN** the user is created in the database and the page redirects to `/admin/users?editing=<new-id>`

#### Scenario: Invalid email on create
- **WHEN** an admin submits the create form with email "not-an-email"
- **THEN** the system returns a 400 error with message "Invalid email format"

#### Scenario: Missing name on create
- **WHEN** an admin submits the create form with an empty name
- **THEN** the system returns a 400 error with message "Name is required"

#### Scenario: Duplicate email on create
- **WHEN** an admin submits the create form with an email that already exists
- **THEN** the system returns a 400 error with message "Email already exists"

### Requirement: Admin can edit a user
The system SHALL allow an admin to update a user via PUT to `/admin/users/:id`. The inline editor SHALL load the user's data into an editable form. The form SHALL support `name`, `email`, and `role`. Password is NOT editable in the update form. Email uniqueness and format SHALL be validated.

#### Scenario: Successful user edit
- **WHEN** an admin clicks the edit button on a user row, changes the name, and submits
- **THEN** the user's name is updated and the page redirects to `/admin/users` preserving grid state

#### Scenario: Edit with invalid email
- **WHEN** an admin submits the edit form with an invalid email
- **THEN** the system returns a 400 error with message "Invalid email format"

### Requirement: Admin can delete a user
The system SHALL allow an admin to delete a user via DELETE to `/admin/users/:id`. The action SHALL return a 302 redirect preserving grid state.

#### Scenario: Successful user deletion
- **WHEN** an admin clicks the delete button on a user row and confirms
- **THEN** the user is removed from the database and the page redirects to `/admin/users` preserving grid state

#### Scenario: Delete non-existent user
- **WHEN** an admin sends DELETE to `/admin/users/99999`
- **THEN** the system returns a 404 error with message "User not found"
