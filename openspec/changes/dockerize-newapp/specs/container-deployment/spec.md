## ADDED Requirements

### Requirement: Docker image builds successfully

The system SHALL produce a working Docker image from a multi-stage Dockerfile using `node:26-slim` as the base image.

#### Scenario: Image builds without errors

- **WHEN** `docker build -t newapp .` is run in the project root
- **THEN** the build succeeds with exit code 0

#### Scenario: Image contains the remix app

- **WHEN** the built image is inspected
- **THEN** it SHALL contain the `app/` directory, `server.ts`, and `node_modules/`

#### Scenario: Image uses multi-stage build

- **WHEN** the Dockerfile is inspected
- **THEN** it SHALL have a builder stage and a runtime stage, with devDependencies excluded from the final image

### Requirement: Application starts in Docker container

The container SHALL start the Remix 3 application on port 44100 using `node --import remix/node-tsx server.ts`.

#### Scenario: Container starts and listens

- **WHEN** `docker run -p 44100:44100 newapp` is executed
- **THEN** the container starts and logs "Server listening on http://localhost:44100"

#### Scenario: Container handles SIGTERM gracefully

- **WHEN** `docker stop` is sent to the running container
- **THEN** the application SHALL call `closeAppDatabase()` and exit cleanly

### Requirement: Neon database connection works in container

The container SHALL connect to a Neon PostgreSQL database using SSL.

#### Scenario: Database migration runs on startup

- **WHEN** the container starts
- **THEN** `initializeAppDatabase()` runs and creates/verifies all required tables

#### Scenario: Existing users can authenticate

- **WHEN** a POST request with valid credentials is sent to the login endpoint
- **THEN** the response SHALL include a Set-Cookie header for the session

### Requirement: .env file is included in the image

The container image SHALL include a `.env` file with `DATABASE_URL` and `SESSION_SECRET` for the target Neon database.

#### Scenario: .env is present in the image

- **WHEN** the container filesystem is inspected
- **THEN** `/app/.env` SHALL exist and contain `DATABASE_URL` and `SESSION_SECRET`

### Requirement: Playwright browsers are not installed

The container image SHALL NOT include Playwright browser binaries.

#### Scenario: Postinstall skips Playwright

- **WHEN** `CI=true` is set during package installation
- **THEN** the postinstall script SHALL skip Playwright browser installation

### Requirement: Remix package is installed from npm

The `remix` dependency SHALL be resolved from the npm registry as `remix@next`.

#### Scenario: package.json specifies npm version

- **WHEN** `package.json` is inspected
- **THEN** the `remix` dependency SHALL be `"remix": "next"` or a version range like `"^3.0.0-beta.4"`
