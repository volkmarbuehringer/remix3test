## ADDED Requirements

### Requirement: Environment variables loaded at startup before first use

The system SHALL load environment variables from `.env` at startup, before any module reads `process.env` values.

#### Scenario: Env vars available to database module

- **WHEN** the server starts
- **THEN** `DATABASE_URL` SHALL be available in `process.env` before the database module initializes

#### Scenario: Env vars available to session module

- **WHEN** the server starts
- **THEN** `SESSION_SECRET` SHALL be available in `process.env` before the session middleware initializes

#### Scenario: Env vars available to server module

- **WHEN** the server starts
- **THEN** `PORT` SHALL be available in `process.env` before the HTTP server starts

### Requirement: Config file path

The system SHALL load environment configuration from `.env` at the project root.

#### Scenario: Default config path

- **WHEN** `loadEnvFile` is called with `'./.env'`
- **THEN** it SHALL resolve relative to the current working directory
