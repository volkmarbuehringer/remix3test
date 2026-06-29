## ADDED Requirements

### Requirement: API Login
The system SHALL provide a `POST /api/login` endpoint that accepts JSON body with `email` and `password` fields, validates credentials, and returns a bearer token.

#### Scenario: Successful login
- **WHEN** client sends `POST /api/login` with valid `{ "email": "user@example.com", "password": "correct-password" }`
- **THEN** system responds with `200 OK` and JSON body `{ "token": "<opaque-token-string>" }`
- **AND** the returned token is valid for future API requests

#### Scenario: Invalid credentials
- **WHEN** client sends `POST /api/login` with incorrect email or password
- **THEN** system responds with `401 Unauthorized` and JSON body `{ "error": "Invalid email or password" }`

#### Scenario: Missing fields
- **WHEN** client sends `POST /api/login` without `email` or `password` fields
- **THEN** system responds with `400 Bad Request` and JSON body `{ "error": "Email and password are required" }`

#### Scenario: Non-existent user
- **WHEN** client sends `POST /api/login` with an email that does not exist in the system
- **THEN** system responds with `401 Unauthorized` with the same error message as invalid password (no user enumeration)

#### Scenario: Unverified email
- **WHEN** client sends `POST /api/login` with valid credentials for an account where `email_verified` is `0`
- **THEN** system responds with `403 Forbidden` and JSON body `{ "error": "Email not verified" }`

#### Scenario: Rate limiting on login
- **WHEN** client sends more than 10 login attempts per email within 60 seconds
- **THEN** system responds with `429 Too Many Requests` and JSON body `{ "error": "Too many requests. Try again later." }`

#### Scenario: Rate limiting on IP
- **WHEN** more than 20 login attempts from the same IP address within 60 seconds
- **THEN** system responds with `429 Too Many Requests`

### Requirement: Token Format and Storage
The system SHALL generate opaque bearer tokens using cryptographically random bytes, store them as SHA-256 hashes in the `api_tokens` database table, and return the plaintext token only at creation time.

#### Scenario: Token generation
- **WHEN** a token is created after successful login
- **THEN** the token SHALL be 32 bytes of cryptographically random data encoded as base64url (43 characters)
- **AND** the plaintext token SHALL be returned to the client exactly once
- **AND** the SHA-256 hash of the token SHALL be stored in the `api_tokens` table

#### Scenario: Token storage
- **WHEN** a token is hashed and stored
- **THEN** the `api_tokens` record SHALL contain `user_id`, `token_hash`, `created_at`, `expires_at`, and nullable `revoked_at` columns
- **AND** `expires_at` SHALL be set to 30 days from creation

#### Scenario: Token collision
- **WHEN** generating a new token
- **THEN** the system SHALL check for hash collision and regenerate if a duplicate hash exists (astronomically unlikely but defensive)

### Requirement: Token Validation Middleware
The system SHALL provide a middleware function that validates `Authorization: Bearer <token>` headers against the `api_tokens` table and attaches the authenticated user identity to the request context.

#### Scenario: Valid token
- **WHEN** client sends a request to a protected API route with `Authorization: Bearer <valid-token>`
- **THEN** the middleware SHALL look up the SHA-256 hash in `api_tokens`
- **AND** verify the token is not expired (`expires_at` > now)
- **AND** verify the token is not revoked (`revoked_at` IS NULL)
- **AND** attach the corresponding `user` object to the request context
- **AND** allow the request to proceed

#### Scenario: Expired token
- **WHEN** client sends a request with a token whose `expires_at` is in the past
- **THEN** system responds with `401 Unauthorized` and JSON body `{ "error": "Token expired" }`

#### Scenario: Revoked token
- **WHEN** client sends a request with a token whose `revoked_at` is not null
- **THEN** system responds with `401 Unauthorized` and JSON body `{ "error": "Token revoked" }`

#### Scenario: Missing or malformed Authorization header
- **WHEN** client sends a request without an `Authorization` header, or with a header that does not match `Bearer <token>` format
- **THEN** system responds with `401 Unauthorized` and JSON body `{ "error": "Missing or malformed Authorization header" }`

#### Scenario: Invalid token (hash not found)
- **WHEN** client sends a request with `Authorization: Bearer <unknown-token>`
- **THEN** system responds with `401 Unauthorized` and JSON body `{ "error": "Invalid token" }`

### Requirement: API Logout
The system SHALL provide a `POST /api/logout` endpoint that revokes the current bearer token by setting its `revoked_at` timestamp.

#### Scenario: Successful logout
- **WHEN** an authenticated client sends `POST /api/logout` with `Authorization: Bearer <valid-token>`
- **THEN** the system SHALL set `revoked_at` to the current timestamp for that token
- **AND** respond with `200 OK` and JSON body `{ "success": true }`

#### Scenario: Logout without token
- **WHEN** client sends `POST /api/logout` without an `Authorization` header
- **THEN** the system responds with `401 Unauthorized`

### Requirement: Backward-Compatible WEBHOOK_TOKEN Fallback
The system SHALL support the existing `WEBHOOK_TOKEN` as a fallback for routes that currently use `authenticateWebhook()`, maintaining backward compatibility.

#### Scenario: WEBHOOK_TOKEN still works
- **WHEN** client sends a request with `Authorization: Bearer <WEBHOOK_TOKEN_value>`
- **THEN** the middleware SHALL first check `api_tokens`, and if no match, fall back to comparing against `WEBHOOK_TOKEN` env var
- **AND** if matched, allow the request to proceed (no user identity attached for webhook token)

### Requirement: Rate Limiting on Login
The system SHALL rate-limit the `POST /api/login` endpoint using the existing in-memory rate limiter.

#### Scenario: Per-email rate limit
- **WHEN** more than 10 login attempts fail for the same email within 60 seconds
- **THEN** subsequent attempts return `429 Too Many Requests`

#### Scenario: Per-IP rate limit
- **WHEN** more than 20 login attempts originate from the same IP within 60 seconds
- **THEN** subsequent attempts return `429 Too Many Requests`
