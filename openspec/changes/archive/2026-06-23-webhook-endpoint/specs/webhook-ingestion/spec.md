## ADDED Requirements

### Requirement: Token-authenticated POST endpoint

The system SHALL expose a POST endpoint at `/webhook/:token` that accepts JSON request bodies.

#### Scenario: Successful request with valid token

- **WHEN** a POST request is sent to `/webhook/:token` with a valid token and a JSON body
- **THEN** the server SHALL respond with HTTP 200 and a JSON body containing the inserted record's UUID (returned via `RETURNING id`)
- **THEN** the returned UUID SHALL be of type UUID format (not a string representation of a number)

#### Scenario: Request with invalid token

- **WHEN** a POST request is sent to `/webhook/:token` with an invalid token
- **THEN** the server SHALL respond with HTTP 401

#### Scenario: Request with non-JSON body

- **WHEN** a POST request is sent with a non-JSON Content-Type or unparseable body
- **THEN** the server SHALL respond with HTTP 400

### Requirement: Payload stored in database

The system SHALL store the received JSON payload, the token used, request headers, source IP, and a timestamp in the `webhook_requests` table.

#### Scenario: Payload inserted

- **WHEN** a valid webhook request is received
- **THEN** a new row SHALL be inserted into `webhook_requests` with the parsed JSON payload, the token value, the request headers as JSONB, the source IP, and the current timestamp

### Requirement: SSE notification after insertion

After a successful insertion, the system SHALL emit an event on the SSE channel so the viewer page can refresh.

#### Scenario: Viewer receives refresh after webhook

- **WHEN** a valid webhook POST succeeds
- **THEN** the SSE channel SHALL notify connected clients that new data is available
