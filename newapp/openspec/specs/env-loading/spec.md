## Purpose

How environment variables are loaded at startup, before any module reads `process.env` values.

## Requirements

### Requirement: Environment variables loaded at startup before first use

The system SHALL load environment variables from `.env` at startup, before any module reads `process.env` values.

#### Scenario: Env vars available to database module

- **WHEN** the server starts via `npm run dev` or `npm run start`
- **THEN** `DATABASE_URL` SHALL be available in `process.env` before the database module initializes

#### Scenario: Env vars available to session module

- **WHEN** the server starts via `npm run dev` or `npm run start`
- **THEN** `SESSION_SECRET` SHALL be available in `process.env` before the session middleware initializes

#### Scenario: Env vars available to server module

- **WHEN** the server starts via `npm run dev` or `npm run start`
- **THEN** `PORT` SHALL be available in `process.env` before the HTTP server starts

#### Scenario: Env vars available without `.env` file

- **WHEN** `.env` does not exist at the project root
- **THEN** the server SHALL start without error and `process.env` SHALL contain only system-set variables

### Requirement: Config file path

The system SHALL load environment configuration from `.env` at the project root via the Node.js `--env-file-if-exists` CLI flag.

#### Scenario: Default config path

- **WHEN** the server starts via `node --env-file-if-exists=.env ...`
- **THEN** the `.env` file SHALL be resolved relative to the current working directory

#### Scenario: Flag variant

- **WHEN** the server starts
- **THEN** the system SHALL use `--env-file-if-exists` (not `--env-file`) so that a missing `.env` file does not crash the process
