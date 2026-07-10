## Context

Currently `remix test` shares the `newapp` database with the dev server. Tests create data, clean up best-effort, and debris accumulates. With 6 parallel workers and 2500+ orphaned users, the database is no longer a reliable starting state. Tests that depend on seeded users (`admin@newapp.com`) or assume certain row counts fail intermittently.

The testing infrastructure uses `test/setup.ts` for global setup/teardown and `app/data/setup.ts` for migration/seed (deduplicated via a module-level promise). No existing test file needs modification — the isolation boundary should live entirely in `test/setup.ts`.

## Goals / Non-Goals

**Goals:**

- Each `remix test` invocation gets a clean PostgreSQL database with migrated schema and seeded data
- Zero modifications to existing test files
- Database name is unique per run to support concurrent CI jobs
- Temp database is dropped after all workers complete
- Startup overhead is minimal (migrate + seed)

**Non-Goals:**

- Within-run parallel test isolation (workers still share the temp DB — existing uniqueness conventions apply)
- Transaction-based isolation per test
- Schema-per-worker isolation
- Cloud/CI-specific orchestration (local Postgres only for now)

## Decisions

### Decision 1: Ephemeral database per run (not transaction isolation or schema-per-worker)

**Approach:** `globalSetup()` creates a temp DB, runs migration + seed, updates `DATABASE_URL`. `globalTeardown()` drops it.

**Alternatives considered:**

- **Transaction-per-test rollback:** Requires pinning each test to a single DB connection and wrapping every test body. Breaks if tests explicitly commit. Complex with `pg.Pool` where queries may hit different connections.
- **Schema-per-worker:** Each worker gets its own Postgres schema with identical tables. Requires search_path manipulation per worker process and N× migration runs. Test helpers that assume default `public` schema would need updates.
- **`.env.test` + manual cleanup:** Simpler but doesn't guarantee clean state — still relies on best-effort cleanup.

**Rationale:** Ephemeral DB per run solves the accumulation problem completely with zero test changes. The existing `initializeAppDatabase()` pattern and `process.env` propagation through forked workers make this a natural fit.

### Decision 2: Database naming scheme

**Format:** `newapp_test_<epoch-ms>_<pid>`

```
newapp_test_1740000000123_12345
```

**Rationale:** Timestamp provides temporal ordering. PID prevents collisions from concurrent runs on the same host. The `newapp_test_` prefix enables simple orphan detection (`LIKE 'newapp_test_%'`). No special characters — safe in double-quoted identifiers.

### Decision 3: Admin pool connects to `postgres` maintenance database

`CREATE DATABASE` and `DROP DATABASE` cannot target the database being created/dropped. The admin pool connects to the always-present `postgres` maintenance database using the same credentials as `DATABASE_URL`.

**Rationale:** The default `postgres` superuser always has `CREATEDB` privilege. No additional configuration needed. The admin pool is created, used once, and closed before test workers fork.

### Decision 4: Run migration + seed via `initializeAppDatabase()` in `globalSetup()`

Rather than calling `migrate()` and `seed()` directly, the setup imports `app/data/setup.ts` and calls `initializeAppDatabase()`. This triggers the module-level promise, which:

1. Imports `connection.ts` — creating the `Pool` with the updated `DATABASE_URL` connected to the temp DB
2. Runs migration once
3. Runs seed once

**Rationale:** Since `initializeAppDatabase` is cached at the module level via `initializePromise`, all subsequent calls from test files are no-ops. The pool created in `globalSetup` is the same Node.js module instance — but since test workers are separate processes (forks), each worker creates its own pool instance. However, `process.env.DATABASE_URL` propagates via `fork()` environment inheritance, so each worker's pool connects to the same temp DB.

### Decision 5: Teardown closes app pool first, then drops database

`globalTeardown()` imports and closes the app pool before connecting with the admin pool to drop the temp database. Order matters: `DROP DATABASE` fails if any connections to it are active.

**Rationale:** Ensures clean teardown. If the app pool has lingering connections, the drop will fail with "cannot drop database while other connections exist."

## Execution Flow

```
globalSetup()                             globalTeardown()
┌──────────────────────┐                  ┌──────────────────────┐
│ Load .env            │                  │ Close app pool       │
│ Parse DATABASE_URL   │                  │                      │
│                      │                  │ Admin pool to        │
│ Admin pool to        │                  │ postgres DB          │
│ postgres DB          │                  │                      │
│                      │                  │ DROP DATABASE        │
│ CREATE DATABASE      │                  │ newapp_test_*        │
│ newapp_test_*        │                  │                      │
│                      │                  │ Close admin pool     │
│ Close admin pool     │                  └──────────────────────┘
│                      │
│ Set DATABASE_URL     │     fork()
│ to newapp_test_*     ──────────►  6 workers each with own Pool
│                      │              connected to same temp DB
│ Call                 │
│ initializeAppDatabase│
│  → import connection │
│  → pool to temp DB   │
│  → migrate           │
│  → seed              │
└──────────────────────┘
```

## Risks / Trade-offs

| Risk                                           | Mitigation                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `CREATEDB` privilege missing on Postgres user  | Current `postgres` superuser has it. Document as requirement for CI.                                       |
| Orphan databases from SIGKILL                  | Name pattern `newapp_test_%` enables identification. Add cleanup script separately.                        |
| Startup latency from migrate + seed            | ~1-2s. Acceptable for test correctness. Could cache a template database in CI.                             |
| `CREATE DATABASE` fails if `template1` is busy | Unlikely in local dev. Rare in CI. Retry or fail with clear message.                                       |
| Migration assumes empty database               | Already true for fresh DB. Existing idempotent guards (`IF NOT EXISTS`) are still correct but unnecessary. |
