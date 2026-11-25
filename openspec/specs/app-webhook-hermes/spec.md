## Purpose

A token-authenticated HTTP endpoint that accepts JSON payloads via POST, stores them in the database, and forwards the data to the hermes event processor for background handling. Powers app-specific webhook integrations with external event processing.

## Requirements

### Requirement: Webhook payload ingestion with UUID generation

The system SHALL accept POST requests to `/app-webhook` with a JSON body and insert the payload into the `webhook_requests` table, returning the generated UUID via `RETURNING id`.

- The endpoint SHALL validate `Content-Type: application/json`
- The endpoint SHALL reject payloads larger than 256KB with status 413
- The endpoint SHALL reject invalid JSON with status 400
- The endpoint SHALL authenticate via the `Authorization: Bearer <token>` header validated against the `api_tokens` table via the `apiTokenAuth` middleware
- The endpoint SHALL return 401 if the token is invalid, expired, or revoked
- The endpoint SHALL return 401 if the header is missing
- The endpoint SHALL return 401 if a non-Bearer Authorization scheme is used
- The endpoint SHALL NOT check `process.env.WEBHOOK_TOKEN`
- The endpoint SHALL strip sensitive headers (authorization, cookie, x-api-key, etc.) before storage
- On success, the endpoint SHALL return the generated UUID and the hermes delivery_id

#### Scenario: Successful ingestion with UUID

- **WHEN** a valid POST is sent to `/app-webhook` with `Authorization: Bearer <valid-per-user-token>` and a JSON body
- **THEN** the payload is inserted into `webhook_requests` with a UUID
- **THEN** the response SHALL contain `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }` with status 200

#### Scenario: Invalid token

- **WHEN** a POST is sent to `/app-webhook` with `Authorization: Bearer <incorrect-token>`
- **THEN** the endpoint SHALL return status 401

#### Scenario: Missing Authorization header

- **WHEN** a POST is sent to `/app-webhook` without an `Authorization` header
- **THEN** the endpoint SHALL return status 401

#### Scenario: Non-Bearer Authorization scheme

- **WHEN** a POST is sent to `/app-webhook` with `Authorization: Basic <token>` or any non-Bearer scheme
- **THEN** the endpoint SHALL return status 401

#### Scenario: Expired token

- **WHEN** a POST is sent to `/app-webhook` with `Authorization: Bearer <expired-token>`
- **THEN** the endpoint SHALL return status 401

#### Scenario: Revoked token

- **WHEN** a POST is sent to `/app-webhook` with `Authorization: Bearer <revoked-token>`
- **THEN** the endpoint SHALL return status 401

#### Scenario: Oversized payload

- **WHEN** a POST is sent with a payload exceeding 256KB
- **THEN** the endpoint SHALL return status 413

### Requirement: Hermes event forwarding

After inserting the webhook payload, the system SHALL POST the UUID and payload to the hermes event processor at `http://127.0.0.1:8644/webhooks/app-webhook`.

- The POST body SHALL be `{ "id": "<uuid>", "payload": { ... } }` where the UUID comes from the INSERT RETURNING clause
- The hermes fetch SHALL use a 3-second timeout
- The hermes HTTP response code SHALL be stored in the `webhook_requests.hermes_status` column
- If hermes is unreachable, the API SHALL still return success (data is persisted) with `hermes_status` set to `"error"`
- If the caller disconnects while the hermes POST is in flight, the wait SHALL abort and `hermes_status` SHALL be set to `"aborted"`; `"error"` remains reserved for a timeout or unreachable hermes
- On successful hermes delivery, the response SHALL include the `callbackUrl` and original `payload`

#### Scenario: Hermes responds successfully

- **WHEN** the insert succeeds and hermes responds with HTTP 202
- **THEN** the response SHALL include `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }`
- **THEN** `webhook_requests.hermes_status` SHALL be `"202"`

#### Scenario: Hermes is unreachable

- **WHEN** the insert succeeds but hermes does not respond within 3 seconds
- **THEN** the response SHALL still return 200 with `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }`
- **THEN** `webhook_requests.hermes_status` SHALL be `"error"`

#### Scenario: Caller disconnects while hermes is processing

- **WHEN** the request signal aborts while the hermes POST is in flight
- **THEN** the fetch SHALL stop waiting and `webhook_requests.hermes_status` SHALL be `"aborted"`
- **AND** the stored payload row SHALL remain intact
- **AND** `"error"` SHALL NOT be used for a caller disconnect
