## Purpose

The `/testagent` route provides an SSE-streaming AI chat interface for exploring the project filesystem. It was originally dev-only but is now available in all environments behind authentication, with a nav entry in the admin sidebar.

## Requirements

### Requirement: Test agent route SHALL be available in all environments behind auth

The `/testagent` route SHALL be registered in all NODE_ENV values (not just development). Access to the route SHALL require an authenticated session. Unauthenticated requests SHALL redirect to the login page (or return a 401 for frame requests).

#### Scenario: Authenticated user accesses test agent
- **WHEN** an authenticated user navigates to `/testagent`
- **THEN** they SHALL see the test agent chat page

#### Scenario: Unauthenticated user is redirected
- **WHEN** an unauthenticated user navigates to `/testagent`
- **THEN** they SHALL be redirected to `/auth/login`

#### Scenario: Frame request without auth returns 401
- **WHEN** an unauthenticated frame request (X-Remix-Frame: true) hits `/testagent`
- **THEN** the server SHALL return a 401 with an HTML fragment indicating not authorized

### Requirement: Test agent SHALL appear in admin sidebar

The admin sidebar SHALL include a "Test-Agent" nav item under the "Daten" group, navigating to `/testagent`.

#### Scenario: Admin sidebar shows Test-Agent link
- **WHEN** any admin sidebar is rendered
- **THEN** a nav item labeled "Test-Agent" SHALL appear under "Daten"
- **AND** it SHALL link to `/testagent`

#### Scenario: Test-Agent nav item is highlighted when active
- **WHEN** the current route is `/testagent` or a sub-route
- **THEN** the "Test-Agent" nav item SHALL show active state

### Requirement: Test agent SSE and approval endpoints SHALL inherit auth

All `/testagent` sub-routes (`/testagent/stream/:runId`, `/testagent/approve`, `/testagent/decline`) SHALL be protected by the same auth middleware.

#### Scenario: Unauthenticated SSE connection rejected
- **WHEN** an unauthenticated request is made to `/testagent/stream/:runId`
- **THEN** the request SHALL be rejected with a redirect to login (or 401 for frame)
