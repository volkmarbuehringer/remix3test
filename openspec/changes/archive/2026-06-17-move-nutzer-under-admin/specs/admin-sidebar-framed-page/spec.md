## ADDED Requirements

### Requirement: Admin page with render-on-error inside sidebar Frame

The system SHALL support rendering form validation errors inline on a CRUD page that lives inside the admin sidebar Frame layout.

#### Scenario: Validation error renders inline errors inside the Frame

- **WHEN** a user submits a form on a page inside the admin Frame
- **AND** server-side validation fails
- **AND** the controller returns `renderAdminPage(..., { status: 400 })` with `fieldErrors`
- **THEN** the Frame SHALL display the re-rendered page content including inline field errors
- **AND** the admin sidebar SHALL remain visible and unchanged

#### Scenario: Successful form submission inside the Frame redirects within the Frame

- **WHEN** a user submits a form on a page inside the admin Frame
- **AND** the server processes successfully and returns a redirect
- **THEN** the Frame SHALL navigate to the redirect URL without a full page reload

#### Scenario: Page navigation (sort, pagination, filter) stays inside the Frame

- **WHEN** a user clicks a sort header, pagination link, or submits a filter form
- **AND** the element has `rmx-target={frames.adminContent}`
- **THEN** the Frame SHALL navigate to the target URL without a full page reload
