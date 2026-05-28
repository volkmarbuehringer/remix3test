## ADDED Requirements

### Requirement: Admin authorization middleware

The system SHALL provide a `requireAdmin()` middleware function that protects admin routes by checking authentication status and user role.

#### Scenario: Authenticated admin user passes
- **WHEN** a request has a valid session with a user whose `role` is `"admin"`
- **THEN** the middleware SHALL allow the request to proceed to the controller action

#### Scenario: Unauthenticated user redirected
- **WHEN** a request does not have a valid session
- **THEN** the middleware SHALL redirect the user to `/login` with a 302 response

#### Scenario: Authenticated non-admin user gets 403
- **WHEN** a request has a valid session but the user's `role` is not `"admin"`
- **THEN** the middleware SHALL return a 403 response with an "Access Denied" HTML page

#### Scenario: Middleware requires auth middleware
- **WHEN** `requireAdmin()` is used without the auth() middleware being registered first
- **THEN** the middleware SHALL throw an error indicating auth middleware must precede it
