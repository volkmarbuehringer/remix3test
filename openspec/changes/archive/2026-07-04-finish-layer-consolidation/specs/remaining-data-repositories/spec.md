## ADDED Requirements

### Requirement: Every remaining controller consumes repositories via `context.db`

Every controller in `app/actions/**` that previously called `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK` SHALL consume one or more repository functions exported from `app/data/**`, passing `context.db`. No `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK` SHALL appear in `app/actions/**` or `app/middleware/**`.

#### Scenario: Verwaltung offerings controller has no raw SQL

- **WHEN** a maintainer greps `app/actions/verwaltung/offerings/controller.tsx` for `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK`
- **THEN** zero matches are returned

#### Scenario: Verwaltung appointments controller has no raw SQL

- **WHEN** a maintainer greps `app/actions/verwaltung/appointments/controller.tsx` for `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK`
- **THEN** zero matches are returned

#### Scenario: Appointments-new controller consumes repositories

- **WHEN** the `appointments-new` controller needs to list resources, render appointment rows, validate a resource id, or create/delete an appointment
- **THEN** it calls a function exported from `app/data/appointments-new-queries.ts` passing `context.db`
- **AND** does not import `pool` from `app/data/setup.ts` or `app/data/connection.ts`

#### Scenario: Uploads middleware consumes repository

- **WHEN** the `uploads` middleware (`app/middleware/uploads.ts`) needs to persist or read an uploaded file record
- **THEN** it calls a function exported from `app/data/uploads.ts` passing `context.db`
- **AND** does not call `pool.query` directly

#### Scenario: Webhook flow controllers consume repositories

- **WHEN** any of the `webhook`, `app-webhook`, `callback`, `webhook-requests`, or `webhook-requests/create` controllers persists or reads a webhook request
- **THEN** each controller calls functions exported from its corresponding `app/data/<domain>.ts` module passing `context.db`

#### Scenario: Admin and settings controllers consume repositories

- **WHEN** any of `admin/lists`, `admin/messages`, `settings`, `appointment`, `verwaltung/offering-configs`, `verwaltung/report1`, `verwaltung/pdf`, `verwaltung/users-pdf`, or `verwaltung/users-export` needs persisted data
- **THEN** it calls a function exported from its corresponding `app/data/<domain>.ts` module passing `context.db`

#### Scenario: No raw SQL anywhere outside data

- **WHEN** a maintainer greps `app/actions/**` and `app/middleware/**` (excluding `*.test.*` and `controller.test-utils.ts`) for `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, or `ROLLBACK`
- **THEN** zero matches are returned

### Requirement: Repositories for remaining domains use the established pattern

Each new repository module created for this change SHALL accept `Database` from `remix/data-table` as its first parameter, export typed shape types co-located with the SQL that produces them, use `db.exec()` for raw SQL and `db.transaction(async tx => …)` for transactions, and never reach into `pool` directly.

#### Scenario: Offerings repository matches nutzer pattern

- **WHEN** a maintainer reads `app/data/offerings-queries.ts`
- **THEN** it imports `type Database` from `'remix/data-table'`
- **AND** exports `OfferingRow` and `OfferingsResourceOption` types
- **AND** no function in the module accepts or imports `pg.Pool`

#### Scenario: Appointments-new repository exposes ResourceOption

- **WHEN** a maintainer reads `app/data/appointments-new-queries.ts`
- **THEN** it exports `ResourceOption` and `DayWithSlots` types
- **AND** the appointments-new controller imports those types from there

#### Scenario: Offerings create and update preserve parallel validation

- **WHEN** the `create` and `update` actions of the offerings controller invoke validation
- **THEN** the validation SQL lives in repository functions in `app/data/offerings-queries.ts`
- **AND** the two actions keep separate validation bodies (no deduplication — that is a Non-Goal)

### Requirement: Promoted lib domain modules use the repository seam

`app/data/lists.ts` (moved from `app/lib/lists-api.ts`) and `app/data/chatlog.ts` (moved from `app/lib/chatlog.ts`) SHALL import `Database` instead of `pg.Pool` and SHALL be consumed via `context.db` by their callers (lists, ai, admin/chatlog controllers).

#### Scenario: Lists data access no longer imports Pool

- **WHEN** a maintainer greps `app/data/lists.ts` for `pg` or `Pool`
- **THEN** zero matches are returned

#### Scenario: Chatlog access uses context.db

- **WHEN** the AI controller or admin chatlog controller reads chat logs
- **THEN** it calls a function exported from `app/data/chatlog.ts` passing `context.db`
