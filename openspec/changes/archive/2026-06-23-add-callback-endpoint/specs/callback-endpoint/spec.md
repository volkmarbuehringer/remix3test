## ADDED Requirements

### Requirement: Localhost-restricted callback endpoint

The system SHALL expose a POST endpoint at `/callback` that accepts JSON payloads from Hermes with processing results.

- The endpoint SHALL only accept requests from localhost (127.0.0.1, ::1, or the application's own host)
- The endpoint SHALL return 403 if the request originates from a non-localhost address
- The endpoint SHALL parse the JSON body with fields: `id` (UUID string), `status` (string), `result` (any JSON)
- The endpoint SHALL return 400 if the body is not valid JSON or `id` is missing
- The endpoint SHALL update the `webhook_requests` row matching the `id` with the callback data
- The endpoint SHALL store the full callback body in the `callback_response` JSONB column
- The endpoint SHALL store the current timestamp in `callback_received_at` BIGINT column
- The endpoint SHALL return 404 if no row matches the given `id`
- The endpoint SHALL return 200 with `{ "status": "ok" }` on success

#### Scenario: Successful callback from Hermes

- **WHEN** a POST request is sent to `/callback` from localhost with JSON body `{ "id": "<valid-uuid>", "status": "completed", "result": { "output": "data" } }`
- **THEN** the endpoint SHALL update the `webhook_requests` row with `callback_response` set to the received JSON and `callback_received_at` set to the current time
- **THEN** the endpoint SHALL return HTTP 200 with `{ "status": "ok" }`

#### Scenario: Non-localhost request rejected

- **WHEN** a POST request is sent to `/callback` from a non-localhost IP address
- **THEN** the endpoint SHALL return HTTP 403

#### Scenario: Invalid JSON body

- **WHEN** a POST request is sent to `/callback` with a non-JSON or malformed body
- **THEN** the endpoint SHALL return HTTP 400

#### Scenario: Missing id field

- **WHEN** a POST request is sent to `/callback` with valid JSON but missing the `id` field
- **THEN** the endpoint SHALL return HTTP 400

#### Scenario: UUID not found in database

- **WHEN** a POST request is sent to `/callback` with a valid UUID that does not exist in `webhook_requests`
- **THEN** the endpoint SHALL return HTTP 404
