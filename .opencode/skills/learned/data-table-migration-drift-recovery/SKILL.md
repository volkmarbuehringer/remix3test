---
name: data-table-migration-drift-recovery
description: "Recover from data-table migration checksum drift and orphaned journal entries that break app startup"
user-invocable: false
origin: auto-extracted
---

# Data-Table Migration Checksum Drift Recovery

**Extracted:** 2026-08-18
**Context:** Editing an applied migration's `up.sql` breaks startup with a checksum-drift error; deleting the migration file makes it worse (orphaned journal entry). Applies to `@remix-run/data-table` (branch-pinned `~/remix`).

## Problem

The `remix/data-table` migration runner journals each applied migration and checksums its SQL. Two startup failures are possible, and the second is a dead end:

1. **Drift**: editing an applied migration's `up.sql` throws `Migration checksum drift detected for "<id>" (journal=<old>, current=<new>)` at `~/remix/packages/data-table/src/lib/migrations/runner.ts:118`.
2. **Orphaned journal entry (worse)**: deleting the migration file does NOT fix #1 — the runner now throws `Applied migration "<id>_<name>" is missing from current migrations` (runner.ts:110) because the journal row in `data_table_migrations` has no matching file. Forward runs hard-error on orphans; only `down` runs ignore them.

The vendor `remix` skill already documents that drift is detected (`references/data-and-validation.md`, "the database checksums each up.sql and detects drift if a previously applied migration changes") and that migrations must be immutable artifacts — this skill covers what to do when it happens.

## Solution

Three recovery paths (pick by context):

1. **Revert the migration edit** — restore the original `up.sql` so the checksum matches the journal. Cleanest when the edit was accidental.
2. **Clear the journal** — one-time DB surgery: `DELETE FROM data_table_migrations;` (or drop the table). Lets `db.migrate()` start clean; the schema already exists so nothing re-runs.
3. **Stop consulting the journal — bootstrap the schema instead (newapp's choice)**. Route schema creation through `db.executeScript()` with idempotent DDL so no journal is read:

```ts
export async function initializeAppDatabase(): Promise<void> {
  await db.executeScript(await loadAppSchema()) // db/schema.sql
  await seed(db)
}
```

`db/schema.sql` uses `CREATE TABLE / INDEX / EXTENSION IF NOT EXISTS` throughout, so startup is a no-op on an existing DB. Because no journal is consulted, neither the drift nor the orphaned-entry error can ever fire.

### Gotchas (verified against vendor source)

- **`db.exec(sql, [])` cannot run multi-statement DDL.** It routes through the parameterized extended protocol, which rejects multi-statement scripts. Use `db.executeScript(sql)` (database.ts:426) — the simple-query path migrations use — for the schema file.
- **`CREATE EXTENSION IF NOT EXISTS` is not advisory-lock-serialized** in the bootstrap path (the old migration runner acquired `pg_advisory_lock`, `data-table-postgres/src/lib/driver.ts:586`). Two instances cold-booting an empty catalog can race and one fails with `duplicate key value violates unique constraint "pg_extension_name_index"`. The script runs as one implicit transaction, so the loser rolls back completely; a single retry is a safe no-op.
- **`CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized** and safe under concurrent boot.

## When to Use

- App startup fails with `Migration checksum drift detected` or `Applied migration ... is missing from current migrations`
- You need to edit or delete a previously-applied `data-table` migration
- You are replacing a migration runner with an idempotent schema bootstrap (`db/schema.sql` + `db.executeScript`)
