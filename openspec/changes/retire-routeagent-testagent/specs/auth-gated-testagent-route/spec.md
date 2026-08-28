## REMOVED Requirements

### Requirement: Test agent route SHALL be available in all environments behind auth

**Reason**: The `/testagent` route is a dev-only filesystem-explorer prototype being retired. The route is deleted in all environments.

**Migration**: No replacement. Project filesystem exploration is no longer available through an agent interface.

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

**Reason**: The test agent is retired; its admin sidebar entry is removed.

**Migration**: Remove the "Test-Agent" nav item and its icon from the admin sidebar.

#### Scenario: Admin sidebar shows Test-Agent link

- **WHEN** any admin sidebar is rendered
- **THEN** a nav item labeled "Test-Agent" SHALL appear under "Daten"
- **AND** it SHALL link to `/testagent`

#### Scenario: Test-Agent nav item is highlighted when active

- **WHEN** the current route is `/testagent` or a sub-route
- **THEN** the "Test-Agent" nav item SHALL show active state

### Requirement: Test agent SSE and approval endpoints SHALL inherit auth

**Reason**: The `/testagent` sub-routes are deleted with the route.

**Migration**: No replacement — the endpoints no longer exist.

#### Scenario: Unauthenticated SSE connection rejected

- **WHEN** an unauthenticated request is made to `/testagent/stream/:runId`
- **THEN** the request SHALL be rejected with a redirect to login (or 401 for frame)