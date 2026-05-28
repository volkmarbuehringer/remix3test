## ADDED Requirements

### Requirement: CSRF middleware is present in the middleware chain

The system SHALL include `csrf()` middleware from `remix/csrf-middleware` in the router middleware chain. The middleware SHALL be placed after `session()`, `formData()`, and `methodOverride()` to ensure session context and parsed form data are available when validating CSRF tokens.

#### Scenario: CSRF middleware rejects request with missing token

- **WHEN** a POST/PUT/DELETE request is submitted without a CSRF token
- **THEN** the system returns a 403 Forbidden response

#### Scenario: CSRF middleware accepts request with valid token

- **WHEN** a POST/PUT/DELETE request is submitted with a valid CSRF token matching the session-stored token
- **THEN** the request proceeds to the route handler

#### Scenario: CSRF middleware rejects request with invalid token

- **WHEN** a POST/PUT/DELETE request is submitted with a CSRF token that does not match the session-stored token
- **THEN** the system returns a 403 Forbidden response

#### Scenario: GET requests bypass CSRF validation

- **WHEN** a GET request is submitted
- **THEN** CSRF validation is skipped and the request proceeds normally

### Requirement: Mutation forms include CSRF token

All state-changing forms (POST/PUT/DELETE) that use cookie-backed sessions SHALL include the CSRF token. The `RestfulForm` utility component MAY be updated to include the token automatically.

#### Scenario: RestfulForm includes CSRF token

- **WHEN** a form is rendered using `RestfulForm` with `method` set to POST, PUT, DELETE, or PATCH
- **THEN** the rendered form includes a hidden input field containing the CSRF token value
