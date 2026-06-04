## ADDED Requirements

### Requirement: Single route tree export

The system SHALL define all application routes in a single `routes` object exported from `app/routes.ts`. There SHALL be no other route export objects in the file.

#### Scenario: All URLs are accessible from a single import

- **WHEN** any controller or UI component imports `{ routes }` from `../../routes.ts`
- **THEN** all routes including home, auth, lists, admin, appoinment, verwaltung, and ai SHALL be accessible via `routes.<path>` dot-notation

### Requirement: Auth routes are namespaced under /auth/

The system SHALL place auth-related routes under a `/auth/` URL prefix. Login SHALL be at `/auth/login`, registration at `/auth/register`, and logout at `/auth/logout`.

#### Scenario: Login page URL changes

- **WHEN** a user navigates to the login page
- **THEN** the URL SHALL be `/auth/login`

#### Scenario: Login form posts to auth namespaced URL

- **WHEN** the login form is submitted
- **THEN** the form action SHALL post to `/auth/login`

#### Scenario: Register page URL changes

- **WHEN** a user navigates to the registration page
- **THEN** the URL SHALL be `/auth/register`

#### Scenario: Logout posts to auth namespaced URL

- **WHEN** a logout form is submitted
- **THEN** the form action SHALL post to `/auth/logout`

### Requirement: Lists routes are a nested route map

The system SHALL define lists routes as a nested route map under `route('lists', { ... })` preserving existing URLs (`/lists`, `/lists/save`, `/lists/:id/update`, `/lists/:id`, `/lists/:id/data`).

#### Scenario: Lists index URL preserved

- **WHEN** `routes.lists.index.href()` is called
- **THEN** it SHALL return `/lists`

#### Scenario: Lists save URL preserved

- **WHEN** `routes.lists.save.href()` is called
- **THEN** it SHALL return `/lists/save`

#### Scenario: Lists update URL preserved

- **WHEN** `routes.lists.update.href({ id: '42' })` is called
- **THEN** it SHALL return `/lists/42/update`

### Requirement: All URL generation uses typed href() calls

The system SHALL generate all internal URLs via `routes.*.href()` calls. No hardcoded URL strings (e.g., `/login`, `/register`, `/logout`) SHALL appear in controller logic, UI component markup, or router configuration.

#### Scenario: Login redirect uses typed href

- **WHEN** a controller redirects an unauthenticated user to login
- **THEN** the redirect target SHALL be `routes.auth.login.index.href()` not `'/login'`

#### Scenario: UI links use typed href

- **WHEN** a UI component renders a link to the register page
- **THEN** the `href` attribute SHALL be `routes.auth.register.index.href()` not `'/register'`

### Requirement: Router maps all routes via typed route references

The system SHALL register all route handlers via `router.map(routes.<subtree>, controller)` for route maps or `router.post(routes.<leaf>.href(), action)` for single action routes. No raw URL string registrations (e.g., `router.post('/logout', ...)`) SHALL exist in `app/router.ts`.

#### Scenario: Logout is registered via typed href

- **WHEN** the router registers the logout handler
- **THEN** it SHALL use `router.post(routes.auth.logout.href(), authLogout)` not `router.post('/logout', ...)`
