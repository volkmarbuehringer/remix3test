## ADDED Requirements

### Requirement: Create ephemeral database per test run
The system SHALL create a unique PostgreSQL database before each `remix test` invocation. The database name SHALL be in the format `newapp_test_<timestamp>_<pid>` to ensure uniqueness across concurrent runs.

#### Scenario: Unique database name generated
- **WHEN** `globalSetup()` runs
- **THEN** a database name is constructed using the current timestamp and process ID

#### Scenario: Database exists after creation
- **WHEN** `CREATE DATABASE` executes successfully
- **THEN** the temp database exists on the Postgres server and is empty (no tables)

### Requirement: Migrate and seed the ephemeral database
The system SHALL run migrations and seed on the temp database immediately after creation, using the existing `initializeAppDatabase()` function from `app/data/setup.ts`.

#### Scenario: Migration runs on temp database
- **WHEN** `initializeAppDatabase()` is called after `DATABASE_URL` is updated
- **THEN** all tables are created in the temp database

#### Scenario: Seed data is present
- **WHEN** migration completes and seed runs
- **THEN** the temp database contains the seeded users (`admin@newapp.com`, `user@newapp.com`), resources, offerings, and clients

### Requirement: Set DATABASE_URL before test workers start
The system SHALL set `process.env.DATABASE_URL` to the temp database URL after creation but before test workers are forked, so that all workers and the application pool connect to the temp database.

#### Scenario: Environment variable propagated to workers
- **WHEN** `globalSetup()` completes
- **THEN** `process.env.DATABASE_URL` points to the temp database
- **WHEN** a worker process is forked
- **THEN** it inherits the updated `DATABASE_URL`

### Requirement: Drop ephemeral database after tests
The system SHALL drop the temp database during `globalTeardown()`, after all test workers have completed and closed their pools.

#### Scenario: Database dropped after all tests
- **WHEN** `globalTeardown()` runs
- **THEN** the app pool is closed
- **THEN** `DROP DATABASE` is executed against the postgres maintenance database
- **THEN** the temp database no longer exists

### Requirement: Handle orphan databases
The system SHALL name temp databases with a recognizable pattern (`newapp_test_*`) so orphaned databases from interrupted runs can be identified and cleaned up manually or via script.

#### Scenario: Orphan database is identifiable
- **WHEN** a test run is interrupted (SIGKILL)
- **THEN** any remaining temp database is prefixed with `newapp_test_`
- **THEN** an administrator can query `SELECT datname FROM pg_database WHERE datname LIKE 'newapp_test_%'` to find orphans

### Requirement: No changes to existing tests
The system SHALL NOT require modifications to existing test files. All isolation logic is contained within `test/setup.ts`.

#### Scenario: Existing tests pass unchanged
- **WHEN** an existing test calls `initializeAppDatabase()`
- **THEN** the module-level promise is already resolved (from globalSetup), so migration and seed are skipped
- **WHEN** an existing test imports `pool` or `db` from `app/data/setup.ts`
- **THEN** it connects to the temp database without any code changes
