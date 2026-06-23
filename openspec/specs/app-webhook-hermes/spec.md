## Purpose

A token-authenticated HTTP endpoint that accepts JSON payloads via POST, stores them in the database, and forwards the data to the hermes event processor for background handling. Powers app-specific webhook integrations with external event processing.

## Requirements

### Requirement: Webhook payload ingestion with UUID generation

The system SHALL accept POST requests to `/app-webhook/:token` with a JSON body and insert the payload into the `webhook_requests` table, returning the generated UUID via `RETURNING id`.

- The endpoint SHALL validate `Content-Type: application/json`
- The endpoint SHALL reject payloads larger than 256KB with status 413
- The endpoint SHALL reject invalid JSON with status 400
- The endpoint SHALL authenticate via `:token` parameter compared against the `WEBHOOK_TOKEN` environment variable
- The endpoint SHALL return 401 if the token does not match
- The endpoint SHALL return 503 if `WEBHOOK_TOKEN` is not configured
- The endpoint SHALL strip sensitive headers (authorization, cookie, x-api-key, etc.) before storage
- On success, the endpoint SHALL return the generated UUID and the hermes delivery_id

#### Scenario: Successful ingestion with UUID

- **WHEN** a valid POST is sent to `/app-webhook/:token` with a JSON body and the correct token
- **THEN** the payload is inserted into `webhook_requests` with a UUID
- **THEN** the response SHALL contain `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }` with status 200

#### Scenario: Invalid token

- **WHEN** a POST is sent to `/app-webhook/:token` with an incorrect or missing token
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
- On successful hermes delivery, the response SHALL include the `callbackUrl` and original `payload`

#### Scenario: Hermes responds successfully

- **WHEN** the insert succeeds and hermes responds with HTTP 202
- **THEN** the response SHALL include `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }`
- **THEN** `webhook_requests.hermes_status` SHALL be `"202"`

#### Scenario: Hermes is unreachable

- **WHEN** the insert succeeds but hermes does not respond within 3 seconds
- **THEN** the response SHALL still return 200 with `{ "id": "<uuid>", "callbackUrl": "<url>", "payload": { ... } }`
- **THEN** `webhook_requests.hermes_status` SHALL be `"error"`
