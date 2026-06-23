## MODIFIED Requirements

### Requirement: Token-authenticated POST endpoint

The system SHALL expose a POST endpoint at `/webhook` that accepts JSON request bodies. Authentication SHALL use the `Authorization: Bearer <token>` header compared against the `WEBHOOK_TOKEN` environment variable.

#### Scenario: Successful request with valid token

- **WHEN** a POST request is sent to `/webhook` with `Authorization: Bearer <valid-token>` and a JSON body
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

#### Scenario: Request with non-JSON body

- **WHEN** a POST request is sent with a non-JSON Content-Type or unparseable body
- **THEN** the server SHALL respond with HTTP 400

### Requirement: Payload stored in database

The system SHALL store the received JSON payload, the token used, request headers, source IP, and a timestamp in the `webhook_requests` table.

#### Scenario: Payload inserted

- **WHEN** a valid webhook request is received
- **THEN** a new row SHALL be inserted into `webhook_requests` with the parsed JSON payload, the token value from the `Authorization` header, the request headers as JSONB (with `authorization` stripped), the source IP, and the current timestamp

### Requirement: SSE notification after insertion

After a successful insertion, the system SHALL emit an event on the SSE channel so the viewer page can refresh.

#### Scenario: Viewer receives refresh after webhook

- **WHEN** a valid webhook POST succeeds
- **THEN** the SSE channel SHALL notify connected clients that new data is available

## REMOVED Requirements

### Requirement: Token-authenticated POST endpoint (token-in-path variant)

**Reason**: Token moved from URL path parameter to `Authorization: Bearer` header for security.
**Migration**: Update webhook senders to use `/webhook` (without `/:token` suffix) and include `Authorization: Bearer <token>` header.
