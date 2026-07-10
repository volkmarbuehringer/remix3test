## ADDED Requirements

### Requirement: Protected routes require authentication

All controllers handling sensitive operations (CRUD on data, access to user-specific resources) SHALL apply the `requireAuth()` middleware from `app/middleware/auth.ts` to reject unauthenticated requests.

#### Scenario: Unauthenticated request to /client/grid is redirected

- **WHEN** a request without a valid session hits `GET /client/grid`
- **THEN** the response SHALL be a 302 redirect to `/login?returnTo=/client/grid`

#### Scenario: Unauthenticated POST to /client is redirected

- **WHEN** a request without a valid session hits `POST /client`
- **THEN** the response SHALL be a 302 redirect to `/login` with the original URL as `returnTo`

#### Scenario: Unauthenticated PUT /client/:id is redirected

- **WHEN** a request without a valid session hits `PUT /client/:id`
- **THEN** the response SHALL be a 302 redirect to `/login`

#### Scenario: Unauthenticated DELETE /client/:id is redirected

- **WHEN** a request without a valid session hits `DELETE /client/:id`
- **THEN** the response SHALL be a 302 redirect to `/login`

#### Scenario: Authenticated request to /client/grid succeeds

- **WHEN** a request with a valid session hits `GET /client/grid`
- **THEN** the response SHALL return the grid content

### Requirement: Lists routes use middleware-based auth

The `lists` and `listsShow` routes SHALL apply the `requireAuth()` middleware at the controller level, matching the pattern used by AI and admin controllers.

#### Scenario: Unauthenticated request to /lists redirects to login

- **WHEN** a request without a valid session hits `GET /lists`
- **THEN** the response SHALL be a 302 redirect to `/login`

#### Scenario: Frame request without auth returns 401 HTML

- **WHEN** a request with header `X-Remix-Frame: true` and no valid session hits a protected route
- **THEN** the response SHALL be a 401 with inline HTML content (not a redirect)

### Requirement: Public routes remain accessible without auth

The `/`, `/ui`, `/ui/:component`, and `/assets/*` routes SHALL remain accessible without authentication.

#### Scenario: Home page loads without auth

- **WHEN** a request without a valid session hits `GET /`
- **THEN** the response SHALL return the home page with status 200

#### Scenario: UI showcase loads without auth

- **WHEN** a request without a valid session hits `GET /ui`
- **THEN** the response SHALL return the UI showcase page with status 200
