---
name: ddl-migration-dedicated-client
description: "Run DDL migrations on a dedicated pg.Client, not the shared pool, to avoid timeout and lock-contention issues"
user-invocable: false
origin: auto-extracted
---

# DDL Migration with Dedicated `pg.Client`

**Extracted:** 2026-07-17
**Updated:** 2026-08-14 (newapp switched to driver-owned config-backed `db.migrate()`/`db.reset()`; dedicated-client workaround retired)
**Context:** DDL migrations that timeout during test setup due to pool-level `statement_timeout`, or cause lock contention with application connections.

## Problem

DDL migrations (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.) are slow and acquire ACCESS EXCLUSIVE locks. When run on a connection from a shared `pg.Pool`:

1. The pool's `statement_timeout` (e.g. 30s) kills long-running DDL — test databases on constrained hardware often exceed this.
2. The migration holds a pool connection for its entire duration, reducing availability for application queries.
3. If the pool has `maxUses` or other session-level settings, the migration connection inherits them — DDL may behave differently than expected.
4. Concurrent test workers on separate databases don't share lock space, but parallel domain init (e.g. Mastra `PostgresStoreVNext`) can self-deadlock within a single worker when using pool connections.

## Current State in newapp (2026-08)

The manual dedicated-`Client` migration path is **retired**. newapp now constructs the postgres database config-backed in `app/db.ts` and runs migrations through the data-table driver:

- `db.migrate(...)` / `db.reset({ migrations, seed })` run DDL on a **reserved pool slot** via the driver's `withMigrationLock()` (packages/data-table-postgres driver).
- The driver sets `lock_timeout` to 60s for advisory-lock acquisition (`pg_advisory_lock(hashtext($1))`), then resets it to `default` before running DDL — it does **not** touch `statement_timeout`.
- The migration connection still inherits the pool's `statement_timeout: 30000`. The newapp migration is a single small `create_all` file, so the 30s bound has not been hit; if DDL timeouts recur on constrained hardware, raise/lower the pool `statement_timeout` in `app/db.ts` rather than reintroducing a manual client.
- On failure the driver **destroys the reserved connection** (instead of returning it to the pool) to discard a session with an aborted transaction / still-held advisory lock.

So the dedicated-client workaround below remains a **fallback pattern** for when config-backed `db.migrate()`/`db.reset()` hit the pool `statement_timeout` on slow hardware, not the default newapp approach.

### Config-backed pool tradeoff: no `'error'` listener

Config-backed construction makes the driver own the pool internally (`this.#client = new pg.Pool(config)`), so `wipe()`/`reset()`/`close()` work — but the driver attaches **no `pool.on('error')` listener** and exposes no accessor (all 760 lines of the postgres driver keep `#client` private). Consequences:

- The old manual-pool code attached a listener so server-side terminations of idle connections (Postgres restart, RDS failover, `pg_terminate_backend`) logged instead of crashing the process. That safeguard is gone with config-backed construction.
- Passing your own `pg.Pool` to `createPostgresDatabase(pool)` re-enables the listener but disables `wipe()`/`reset()` (`#configOrThrow` throws "requires config-based construction"), breaking the test-isolation design.
- The vendor CLI path (`createConfiguredDatabase` in `packages/cli/src/lib/commands/db.ts`) is config-backed too and has the same behavior — this is vendor-consistent, not a newapp regression.
- Safe in newapp tests because `db.reset()` → driver `wipe()` closes the pool before terminating backends, and `test/setup.ts` closes the app pool before the force-drop.
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
