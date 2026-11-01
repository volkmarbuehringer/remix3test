# Data-Table Migration Checksum Drift Recovery

**Source:** `data-table-migration-drift-recovery`

**Extracted:** 2026-08-18
**Updated:** 2026-08-19 (vendor added `remix db rollback` CLI, #11723; rollback is now the preferred recovery for runner-based apps)
**Revalidated:** 2026-10-14 against build `2c9e033` / source `e6a63ea` (`@remix-run/data-table` 1.0.0, `@remix-run/data-table-postgres` 1.0.0).
**Context:** Editing an applied migration's `up.sql` breaks startup with a checksum-drift error; deleting the migration file makes it worse (orphaned journal entry). Applies to `@remix-run/data-table` (branch-pinned `remix`, installed in `node_modules/`).

## Problem

The `remix/data-table` migration runner journals each applied migration and checksums its SQL. Two startup failures are possible, and the second is a dead end:

1. **Drift**: editing an applied migration's `up.sql` throws `Migration checksum drift detected for "<id>" (journal=<old>, current=<new>)` at `node_modules/.pnpm/@remix-run+data-table@*/node_modules/@remix-run/data-table/src/lib/migrations/runner.ts:118`.
2. **Orphaned journal entry (worse)**: deleting the migration file does NOT fix #1 — the runner now throws `Applied migration "<id>_<name>" is missing from current migrations` (runner.ts:110) because the journal row in `data_table_migrations` has no matching file. Forward runs hard-error on orphans; only `down` runs ignore them.

The vendor `remix` skill already documents that drift is detected (`node_modules/remix/src/data-table/README.md`, "the database checksums each up.sql and detects drift if a previously applied migration changes") and that migrations must be immutable artifacts — this skill covers what to do when it happens.

## Solution

Four recovery paths (pick by context):

1. **Revert the migration edit** — restore the original `up.sql` so the checksum matches the journal. Cleanest when the edit was accidental.
2. **Roll back via the CLI (preferred for runner-based apps)** — `remix db rollback` walks the journal and reverts applied migrations newest-first. Bounds: `--step <count>` (default `1`) or `--to <id>` (revert back *through* that migration, inclusive; accepts a bare id or the `id_name` directory form). `--dry-run` reports what would be reverted without running it. This is the supported replacement for the "clear the journal" surgery and for undocumented `down` runs — orphaned journal entries are ignored on down runs (runner.ts:105), so rollback stays possible even when a migration file is missing. Note: an empty `--to ""` now throws `Unknown migration target: ""` (runner.ts:66 changed `!to` → `to === undefined` in #11723) — it is **not** a "revert everything" escape hatch.
3. **Clear the journal (last resort)** — one-time DB surgery: `DELETE FROM data_table_migrations;` (or drop the table). Lets `db.migrate()` start clean; the schema already exists so nothing re-runs. Only needed when the CLI is not an option (no migrations directory, or you want to abandon the journal entirely).
4. **Previous choice (2026-08 – 2026-10): stop consulting the journal — bootstrap the schema instead.** newapp used this until 2026-11-01; it now runs the journal again with a single idempotent baseline. The pattern remains valid for an app that wants no journal at all:

```ts
export async function initializeAppDatabase(): Promise<void> {
  await db.executeScript(await loadAppSchema()) // db/schema.sql
  await seed(db)
}
```

`db/schema.sql` uses `CREATE TABLE / INDEX / EXTENSION IF NOT EXISTS` throughout, so startup is a no-op on an existing DB. Because no journal is consulted, neither the drift nor the orphaned-entry error can ever fire.

**Current newapp state (2026-11-01):** the app switched back to the runner. `db/migrations/20261101000000_baseline/up.sql` is a single idempotent baseline, so an existing database adopts the journal on first boot while fresh databases create everything from it. Treat every applied migration as immutable from then on; the recovery paths 1–3 above apply.

## Adoption: re-introducing the runner over a legacy journal

**Context:** The app used an idempotent `db/schema.sql` bootstrap from 2026-08 to 2026-11, but the database still held a `data_table_migrations` row from the pre-2026-08 runner. The row's file no longer existed, so a forward `db.migrate()` failed immediately with `Applied migration "<id>_<name>" is missing from current migrations` before it could apply anything.

Do not delete the legacy journal row or edit its table. Isolate the new runner in a fresh journal table and make the first migration idempotent:

1. `remix.json`:
   ```json
   "db": {
     "adapter": { "type": "postgres", "connectionString": { "env": "DATABASE_URL" } },
     "migrations": { "directory": "./db/migrations", "journalTable": "app_migrations" }
   }
   ```
2. `app/db.ts` must pass the same journal name:
   ```ts
   export const migrationsJournalTable = 'app_migrations'
   await db.migrate(await loadMigrations(migrationsDirectory), {
     journalTable: migrationsJournalTable,
   })
   ```
3. Make the baseline `up.sql` the full current schema with `CREATE ... IF NOT EXISTS` (no `down.sql`; it is intentionally irreversible). An existing database runs it as a no-op and the new journal records it; a fresh database builds everything from it.
4. Keep `data_table_migrations` untouched. The new runner never reads it, so its orphaned rows cannot abort a forward run and an older app version can still read its own history during a rolling deploy.
5. Test the adoption, not just the happy path: create a real `data_table_migrations` table with an orphan row, call `initializeAppDatabase()`, and assert it resolves with `app_migrations` fully applied.
6. Test config parity: `loadConfig()` must report the same `journalTable` and `migrations.directory` used by `app/db.ts`; a mismatch makes `npm run db:status` report a different state than boot.

The Postgres driver's `withMigrationLock` serializes concurrent boots. The app pool's `statement_timeout: 30000` also applies to boot migrations; run heavy changes with `npm run db:migrate` out of band (the CLI connection has no statement timeout).

### Gotchas (verified against vendor source)

- **`db.exec(sql, [])` cannot run multi-statement DDL.** It routes through the parameterized extended protocol, which rejects multi-statement scripts. Use `db.executeScript(sql)` (database.ts:426) — the simple-query path migrations use — for the schema file.
- **`CREATE EXTENSION IF NOT EXISTS` is not advisory-lock-serialized** in the bootstrap path (the old migration runner acquired `pg_advisory_lock`, `data-table-postgres/src/lib/driver.ts:586`). Two instances cold-booting an empty catalog can race and one fails with `duplicate key value violates unique constraint "pg_extension_name_index"`. The script runs as one implicit transaction, so the loser rolls back completely; a single retry is a safe no-op.
- **`CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized** and safe under concurrent boot.

## When to Use

- App startup fails with `Migration checksum drift detected` or `Applied migration ... is missing from current migrations`
- You need to edit or delete a previously-applied `data-table` migration
- You need to revert applied migrations on a runner-based app — use `remix db rollback` (`--step`/`--to`/`--dry-run`), not raw journal surgery
- You are replacing a migration runner with an idempotent schema bootstrap (`db/schema.sql` + `db.executeScript`)
- You are re-adopting the runner on a database that still has a legacy `data_table_migrations` journal, or you need to preserve an old journal while starting a new one
