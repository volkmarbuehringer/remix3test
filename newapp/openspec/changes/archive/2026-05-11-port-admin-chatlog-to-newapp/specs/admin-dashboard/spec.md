## ADDED Requirements

### Requirement: Admin dashboard route serves index page

The system SHALL serve an HTML page at `/admin` that displays an admin dashboard with cards providing links to admin sub-sections.

#### Scenario: GET /admin by admin user
- **WHEN** an authenticated admin user navigates to `/admin`
- **THEN** the system SHALL render a dashboard page with cards linking to admin sub-sections

#### Scenario: GET /admin by unauthenticated user
- **WHEN** an unauthenticated user navigates to `/admin`
- **THEN** the system SHALL redirect to the login page

#### Scenario: GET /admin by non-admin user
- **WHEN** an authenticated non-admin user navigates to `/admin`
- **THEN** the system SHALL return a 403 Access Denied response

### Requirement: Admin dashboard uses frame-based layout

The admin dashboard SHALL render within an admin layout that includes a sidebar with navigation items and a content area. Navigation links within the admin section SHALL use `rmx-target` attributes for client-side frame navigation.

#### Scenario: Initial admin navigation
- **WHEN** a user first navigates to `/admin`
- **THEN** the admin shell SHALL render inside the main app Layout, with an inner Frame loading the admin sidebar and content

#### Scenario: Frame-targeted admin navigation
- **WHEN** a navigation within the admin section includes `rmx-target="admin-content"`
- **THEN** only the admin content area SHALL re-render (sidebar SHALL persist)
