## MODIFIED Requirements

### Requirement: Webhook payload ingestion with UUID generation

The system SHALL accept POST requests to `/app-webhook` with a JSON body and insert the payload into the `webhook_requests` table, returning the generated UUID via `RETURNING id`.

- The endpoint SHALL validate `Content-Type: application/json`
- The endpoint SHALL reject payloads larger than 256KB with status 413
- The endpoint SHALL reject invalid JSON with status 400
- The endpoint SHALL authenticate via the `Authorization: Bearer <token>` header validated against the `api_tokens` table via the `apiTokenAuth` middleware
- The endpoint SHALL return 401 if the token is invalid, expired, or revoked
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

## REMOVED Requirements

### Requirement: WEBHOOK_TOKEN env var check and 503

**Reason**: The `WEBHOOK_TOKEN` environment variable is no longer used. Token validation happens against the `api_tokens` database table, which always has a deterministic result (no "unconfigured" state).

**Migration**: Existing clients must generate a per-user token via `POST /api/login` and use that token in the `Authorization: Bearer` header.
