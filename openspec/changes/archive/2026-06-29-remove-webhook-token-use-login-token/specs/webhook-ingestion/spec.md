## MODIFIED Requirements

### Requirement: Token-authenticated POST endpoint

The system SHALL expose a POST endpoint at `/webhook` that accepts JSON request bodies. Authentication SHALL use the `Authorization: Bearer <token>` header validated against the `api_tokens` table via the `apiTokenAuth` middleware — the same per-user token system used by all other Bearer-token API endpoints.

#### Scenario: Successful request with valid token

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Bearer <valid-per-user-token>` and a JSON body
- **THEN** the server SHALL respond with HTTP 200 and a JSON body containing the inserted record's UUID (returned via `RETURNING id`)
- **THEN** the returned UUID SHALL be of type UUID format (not a string representation of a number)
- **THEN** the token value SHALL be stored in `webhook_requests.token`

#### Scenario: Request with invalid token

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Bearer <invalid-token>`
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with missing Authorization header

- **WHEN** a POST request is sent to `/webhook` without an `Authorization` header
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with non-Bearer Authorization scheme

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Basic <token>` or any non-Bearer scheme
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with expired token

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Bearer <expired-token>` (token past its `expires_at`)
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with revoked token

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Bearer <revoked-token>` (`revoked_at` is set)
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with non-JSON body

- **WHEN** a POST request is sent with a non-JSON Content-Type or unparseable body
- **THEN** the server SHALL respond with HTTP 400

## REMOVED Requirements

### Requirement: WEBHOOK_TOKEN env var validation

**Reason**: Replaced by per-user API token validation against the `api_tokens` database table. The `WEBHOOK_TOKEN` environment variable is no longer checked.

**Migration**: Existing clients must generate a per-user token via `POST /api/login` and use that token in the `Authorization: Bearer` header.
