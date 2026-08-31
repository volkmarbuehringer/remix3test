---
name: ddl-migration-dedicated-client
description: "Run DDL migrations on a dedicated pg.Client, not the shared pool, to avoid timeout and lock-contention issues"
user-invocable: false
origin: auto-extracted
---

# DDL Migration with Dedicated `pg.Client`

**Extracted:** 2026-07-17
**Updated:** 2026-08-18 (newapp switched from `db.migrate()`/`db.reset()` to an idempotent `db/schema.sql` bootstrap via `db.executeScript()`; dedicated-client workaround retired)
**Context:** DDL migrations that timeout during test setup due to pool-level `statement_timeout`, or cause lock contention with application connections.

## Problem

DDL migrations (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.) are slow and acquire ACCESS EXCLUSIVE locks. When run on a connection from a shared `pg.Pool`:

1. The pool's `statement_timeout` (e.g. 30s) kills long-running DDL — test databases on constrained hardware often exceed this.
2. The migration holds a pool connection for its entire duration, reducing availability for application queries.
3. If the pool has `maxUses` or other session-level settings, the migration connection inherits them — DDL may behave differently than expected.
4. Concurrent test workers on separate databases don't share lock space, but parallel domain init (e.g. Mastra `PostgresStoreVNext`) can self-deadlock within a single worker when using pool connections.

## Current State in newapp (2026-08)

The manual dedicated-`Client` migration path and the data-table migration runner are **retired in newapp**. newapp constructs the postgres database config-backed in `app/db.ts` and bootstraps the schema from an idempotent `db/schema.sql`:

- `initializeAppDatabase()` runs `db.executeScript(await loadAppSchema())` then `seed(db)`. `db/schema.sql` uses `CREATE TABLE/INDEX/EXTENSION IF NOT EXISTS`, so startup is a no-op when tables already exist.
- There is **no migration journal** and no checksum tracking. `db.migrate()`/`db.reset({ migrations, seed })`/`loadAppMigrations()` are no longer used; `db/migrations/` and `remix.json`'s `db.migrations.directory` were removed.
- `db.executeScript()` runs the multi-statement script via the driver's simple-query path on the config-backed pool, so DDL inherits the pool `statement_timeout: 30000`. `db.exec(sql, [])` cannot be used instead — it routes through the parameterized extended protocol, which rejects multi-statement scripts.
- `CREATE EXTENSION IF NOT EXISTS` is **not advisory-lock-serialized** (the old migration path acquired `pg_advisory_lock`). Two instances cold-booting an empty catalog can race and one fails with a `pg_extension_name_index` duplicate-key error; the whole implicit-transaction script rolls back, so a single retry in `initializeAppDatabase()` is a safe no-op. `CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized and safe under concurrency.
- `test/setup.ts` uses `db.wipe()` then `initializeAppDatabase()` to build each fresh test DB.

So the dedicated-client workaround below remains a **fallback pattern** for projects that still run the data-table migration runner (or need atomic cross-statement DDL on a dedicated connection with `statement_timeout: 0`) when the pool `statement_timeout` is hit on slow hardware — not the default newapp approach.

### Diagnosing an intermittent catalog duplicate-key in tests

`initializeAppDatabase()` / Mastra `PostgresStoreVNext` runs DDL on the shared local test DB. When several test files each init the store concurrently (default parallel workers), their `CREATE TABLE/EXTENSION` can collide on the Postgres **catalog**, surfacing as an intermittent `duplicate key value violates unique constraint "pg_class_relname_nsp_index"` (or the sibling `pg_extension_name_index`). The failing test **varies between runs** — it is whichever worker happened to race, not a logic bug in the code under test.

**Confirm it's an infra race, not a regression:**
1. Run the failing test file **alone** — it should pass deterministically.
2. Run the **full suite** (`npm test`) — green (the same race may surface in a *different* file, so the single-file pass is the strong signal).
3. For a fully deterministic run, pass `--concurrency 1` to `remix test` to serialize DDL init — slower, but avoids the race.

**When to use:** a test fails only when run with multiple files, with a `pg_class_…` / `pg_extension…` duplicate-key catalog error, and passes in isolation.

### Config-backed pool tradeoff: no `'error'` listener

Config-backed construction makes the driver own the pool internally (`this.#client = new pg.Pool(config)`), so `wipe()`/`reset()`/`close()` work — but the driver attaches **no `pool.on('error')` listener** and exposes no accessor (all 760 lines of the postgres driver keep `#client` private). Consequences:

- The old manual-pool code attached a listener so server-side terminations of idle connections (Postgres restart, RDS failover, `pg_terminate_backend`) logged instead of crashing the process. That safeguard is gone with config-backed construction.
- Passing your own `pg.Pool` to `createPostgresDatabase(pool)` re-enables the listener but disables `wipe()`/`reset()` (`#configOrThrow` throws "requires config-based construction"), breaking the test-isolation design.
- The vendor CLI path (`createConfiguredDatabase` in `packages/cli/src/lib/commands/db.ts`) is config-backed too and has the same behavior — this is vendor-consistent, not a newapp regression.
- Safe in newapp tests because `test/setup.ts` calls `db.wipe()` (driver closes the pool before terminating backends) then closes the app pool before the force-drop.
- If an unhandled pool `'error'` crash surfaces in production, the fix is a driver change (attach a listener or add an `onPoolError` option to `PostgresDatabaseDriverOptions`), not app-side code.

## Fallback Solution

Create a dedicated `pg.Client` for the migration — not from the pool — with `statement_timeout: 0` (unlimited). Wrap all DDL in a `BEGIN` / `COMMIT` transaction for atomicity. Close the client when done.

```typescript
import { Client } from 'pg'
import { pool } from './connection.ts'

const databaseUrl = process.env.DATABASE_URL!

export async function migrate(): Promise<void> {
  let client = new Client({ connectionString: databaseUrl, statement_timeout: 0 })
  await client.connect()
  try {
    await client.query('BEGIN')
    // Acquire advisory lock for multi-process safety (database-scoped)
    await client.query(`SELECT pg_advisory_lock(287140921)`)

    // All DDL here…
    await client.query(`CREATE TABLE IF NOT EXISTS users (…);`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS …;`)

    // Release lock before COMMIT (session-level lock persists across transactions)
    await client.query(`SELECT pg_advisory_unlock(287140921)`)
    await client.query('COMMIT')
  } catch (e) {
    // On error: ROLLBACK + unlock + close
    await client.query('ROLLBACK').catch(() => {})
    await client.query(`SELECT pg_advisory_unlock(287140921)`).catch(() => {})
    throw e
  } finally {
    await client.end().catch(() => {})  // closes connection, releasing any remaining session locks
  }
}
```

### Key details

- **`statement_timeout: 0`** in the `Client` constructor disables the timeout for this connection only. Pool connections keep their configured timeout.
- **`pg_advisory_lock`** is database-scoped and session-level (not transaction-level). It prevents concurrent migrations across processes/workers, even when using separate clients.
- **`client.end()`** in `finally` closes the TCP connection, which automatically releases all session-level advisory locks — so the explicit unlock in the success path is optional.
- **`BEGIN`/`COMMIT`** makes the migration atomic: if any DDL fails, all changes are rolled back.

## When to Use

- Test environments where config-backed `db.migrate()`/`db.reset()` DDL regularly hits the pool `statement_timeout` during `beforeAll` / `globalSetup`
- CI pipelines that create fresh databases per worker and run migrations concurrently
- Any project where the `pg.Pool` has a non-zero `statement_timeout` (common safety measure) that conflicts with DDL
- When you need atomic DDL (all-or-nothing migration)
