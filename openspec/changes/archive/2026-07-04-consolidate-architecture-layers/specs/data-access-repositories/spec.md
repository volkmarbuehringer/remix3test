# Data Access Repositories

## Purpose

Establish a single typed repository layer in `app/data/` that owns all SQL and business-rule validation. Controllers, middleware, and UI consume repositories via `context.db` only and never touch `pg.Pool` directly.

## ADDED Requirements

### Requirement: Every SQL query lives in `app/data/**`
The system SHALL locate every `pool.query`, `pool.connect`, `BEGIN`, `COMMIT`, `ROLLBACK`, and parameterized SQL string inside a module under `app/data/`. Controllers and middleware SHALL NOT execute SQL directly.

#### Scenario: Controller has no SQL string
- **WHEN** a maintainer greps `app/actions/**` and `app/middleware/**` for `pool.query`, `BEGIN`, `COMMIT`, `ROLLBACK`, or `pool.connect(`
- **THEN** zero matches are returned

#### Scenario: Repository owns the query
- **WHEN** a controller needs persisted data for a request
- **THEN** it calls an async function exported from `app/data/<domain>.ts` passing `context.db` (and any filter/value arguments)

### Requirement: Repositories accept `Database`, not `Pool`
Every repository function exposed from `app/data/**` SHALL accept the `Database` adapter from `remix/data-table` (instantiated in `app/data/connection.ts:10-24`) as its first argument. No repository function SHALL accept `pg.Pool`.

#### Scenario: Audit log uses the Database seam
- **WHEN** a controller calls `logAdminAction(...)` after a mutating action
- **THEN** it passes `context.db`, not `context.pool` or a `Pool` reference

#### Scenario: New repositories match appointments.ts shape
- **WHEN** a new repository module such as `app/data/nutzer.ts` or `app/data/offerings-queries.ts` is created
- **THEN** it imports `Database` from the same adapter path as `app/data/appointments.ts`
- **AND** it exports typed business errors following the `AppointmentError`/`AppointmentCollisionError` pattern in `app/data/appointments.ts:22-53`

### Requirement: Transactions live inside repositories
Any multi-statement transaction SHALL be encapsulated by a repository function (e.g. `updateNutzerWithLogin`). Controllers SHALL NOT call `pool.connect()`, `BEGIN`, `COMMIT`, or `ROLLBACK`.

#### Scenario: Nutzer update with login is atomic
- **WHEN** the controller handling `POST /nutzer/:id/edit` invokes the repository
- **THEN** the entire update (nutzer row + login row + audit row) is committed by a single repository function call
- **AND** any failure rolls back the entire transaction inside the repository, surfacing a typed error to the controller

### Requirement: Audit logging uses the repository seam
`app/data/audit-log.ts` SHALL accept the `Database` adapter. All callers SHALL pass `context.db`.

#### Scenario: Audit log signature
- **WHEN** a maintainer inspects `app/data/audit-log.ts`
- **THEN** the exported function declares its first parameter as `Database` (or the local type alias used by other repositories in `app/data/`)
- **AND** no call site in `app/actions/**` or `app/middleware/**` passes a `Pool` instance to it

### Requirement: Domain modules promoted from `app/lib/` use the repository seam
`app/data/lists.ts` (moved from `app/lib/lists-api.ts`) and `app/data/chatlog.ts` (moved from `app/lib/chatlog.ts`) SHALL import `Database` instead of `pg.Pool` and SHALL be consumed via `context.db`.

#### Scenario: Lists data access no longer imports Pool
- **WHEN** a maintainer greps `app/data/lists.ts` for `pg` or `Pool`
- **THEN** zero matches are returned

#### Scenario: Chatlog data access consumed via context.db
- **WHEN** the AI controller or admin chatlog controller reads chat logs
- **THEN** it calls a function exported from `app/data/chatlog.ts` passing `context.db`