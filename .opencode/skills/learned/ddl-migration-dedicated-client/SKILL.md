---
name: ddl-migration-dedicated-client
description: "Run DDL migrations on a dedicated pg.Client, not the shared pool, to avoid timeout and lock-contention issues"
user-invocable: false
origin: auto-extracted
---

# DDL Migration with Dedicated `pg.Client`

**Extracted:** 2026-07-17
**Context:** DDL migrations that timeout during test setup due to pool-level `statement_timeout`, or cause lock contention with application connections.

## Problem

DDL migrations (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.) are slow and acquire ACCESS EXCLUSIVE locks. When run on a connection from a shared `pg.Pool`:

1. The pool's `statement_timeout` (e.g. 30s) kills long-running DDL — test databases on constrained hardware often exceed this.
2. The migration holds a pool connection for its entire duration, reducing availability for application queries.
3. If the pool has `maxUses` or other session-level settings, the migration connection inherits them — DDL may behave differently than expected.
4. Concurrent test workers on separate databases don't share lock space, but parallel domain init (e.g. Mastra `PostgresStoreVNext`) can self-deadlock within a single worker when using pool connections.

## Solution

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

- Test environments where DDL regularly hits `statement_timeout` during `beforeAll` / `globalSetup`
- CI pipelines that create fresh databases per worker and run migrations concurrently
- Any project where the `pg.Pool` has a non-zero `statement_timeout` (common safety measure) that conflicts with DDL
- When you need atomic DDL (all-or-nothing migration)
