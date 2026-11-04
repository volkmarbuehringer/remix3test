# Database Migrations: Runner, Drift, DDL & Catalog Races

**Source:** consolidated from `ddl-migration-dedicated-client` and `data-table-migration-drift-recovery`.
**Extracted:** 2026-07-17 … 2026-08-18
**Revalidated:** 2026-11-04 against preview release `v0.20261103.224609-main-98229b78` / source `98229b788f` (`@remix-run/data-table` 1.0.0).
**Context:** DDL/migrations in a `remix/data-table` app: the runner's journal/checksums, startup drift/orphan errors, boot and test-time DDL races, and the config-backed pool tradeoff.

## Current app state (2026-11)

newapp runs SQL-file migrations from `db/migrations/` through the `remix/data-table` runner:

- `app/db.ts` builds a caller-owned `pg.Pool`, attaches an `'error'` listener, then calls `db.migrate(await loadMigrations('../db/migrations'), { journalTable: 'app_migrations' })` and `seed(db)`. `remix.json` records the same journal under `db.migrations.journalTable`.
- `db/migrations/20261101000000_baseline/up.sql` is the full, idempotent schema. An existing database runs it once and the journal records it; fresh databases create everything from it.
- The runner holds a Postgres advisory lock for the whole run (`withMigrationLock`), so parallel test workers and concurrent cold boots serialize instead of racing `pg_extension_name_index`. The old single-retry workaround is no longer needed.
- Applied migrations are immutable: the runner checksums `up.sql` and fails the next boot on drift or a missing journal entry (below).
- `test/setup.ts` creates a fresh test database, drops `public` through a throwaway pool, then calls `initializeAppDatabase()`; every run therefore exercises the same migrations as production.
- Migrations inherit the pool `statement_timeout: 30000`; `db.exec(sql, [])` cannot run multi-statement DDL (parameterized extended protocol rejects it), while the runner's `executeScript` uses the simple-query path (`database.ts:426`).

The retired `db/schema.sql` bootstrap (2026-08 – 2026-10) and the dedicated-`pg.Client` migration path are **not** needed here; do not reintroduce either as a recovery or bootstrap path.

## Checksum drift and orphaned journal entries

The runner journals each applied migration and checksums its SQL. Two startup failures are possible:

1. **Drift** — editing an applied migration's `up.sql` throws `Migration checksum drift detected for "<id>" (journal=<old>, current=<new>)` at `node_modules/.pnpm/@remix-run+data-table@*/node_modules/@remix-run/data-table/src/lib/migrations/runner.ts` (`:118-123`).
2. **Orphaned journal entry (worse)** — deleting the migration file does NOT fix #1: the runner throws `Applied migration "<id>_<name>" is missing from current migrations` (`runner.ts:110`) because the `data_table_migrations` row has no matching file. Forward runs hard-error on orphans; only `down` runs ignore them (`runner.ts:105`).

The vendor `remix` skill already says drift is detected (`node_modules/remix/src/data-table/README.md`) and that migrations must be immutable artifacts; this reference covers what to do when it happens.

## Recovery paths

Pick by context, preferred first:

1. **Revert the edit** — restore the original `up.sql` so the checksum matches the journal. Cleanest when accidental.
2. **Roll back via the CLI** — `remix db rollback` walks the journal and reverts applied migrations newest-first. Bounds: `--step <count>` (default `1`) or `--to <id>` (revert back *through* that migration, inclusive; accepts a bare id or the `id_name` directory form). `--dry-run` reports what would be reverted. This is the supported replacement for "clear the journal" surgery and for undocumented `down` runs — orphaned journal entries are ignored on down runs (`runner.ts:105`), so rollback stays possible even when a migration file is missing. An empty `--to ""` throws `Unknown migration target: ""` (`runner.ts:77`); it is **not** a "revert everything" hatch.
3. **Clear the journal (last resort)** — one-time DB surgery: `DELETE FROM data_table_migrations;` (or drop the table). Lets `db.migrate()` start clean; the schema already exists so nothing re-runs. Only when the CLI is unavailable.

**Current app state:** the runner uses `app_migrations` and the idempotent baseline above, so paths 1–3 apply. Keep every applied migration immutable; do not reintroduce `db/schema.sql`.

## Adoption: re-introducing the runner over a legacy journal

A database may still carry a `data_table_migrations` row from the pre-2026-08 runner whose file no longer exists, so a forward `db.migrate()` fails immediately with `Applied migration "<id>_<name>" is missing from current migrations` before it can apply anything.

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
3. Make the baseline `up.sql` the full current schema with `CREATE ... IF NOT EXISTS` (no `down.sql`; intentionally irreversible). An existing database runs it as a no-op and the new journal records it; a fresh database builds everything from it.
4. Keep `data_table_migrations` untouched. The new runner never reads it, so its orphaned rows cannot abort a forward run and an older app version can still read its own history during a rolling deploy.
5. Test the adoption, not just the happy path: create a real `data_table_migrations` table with an orphan row, call `initializeAppDatabase()`, and assert it resolves with `app_migrations` fully applied.
6. Test config parity: `loadConfig()` must report the same `journalTable` and `migrations.directory` used by `app/db.ts`; a mismatch makes `npm run db:status` report a different state than boot.

The Postgres driver's `withMigrationLock` serializes concurrent boots. The app pool's `statement_timeout: 30000` also applies to boot migrations; run heavy changes with `npm run db:migrate` out of band (the CLI connection has no statement timeout).

## Diagnosing an intermittent catalog duplicate-key in tests

`initializeAppDatabase()` / Mastra `PostgresStoreVNext` runs DDL on the shared local test DB. When several test files each init the store concurrently (default parallel workers), their `CREATE TABLE/EXTENSION` can collide on the Postgres **catalog**, surfacing as an intermittent `duplicate key value violates unique constraint "pg_class_relname_nsp_index"` (or the sibling `pg_extension_name_index`). The failing test **varies between runs** — it is whichever worker happened to race, not a logic bug in the code under test.

**Mastra's shared schema is pre-initialized once.** `test/setup.ts`'s `initializeMastraStorage()` builds a throwaway `PostgresStoreVNext` with the same config as `app/actions/mastra/storage.ts` (id `mastra`, public schema) and calls `init()` before any worker forks. Workers' lazy auto-init then finds the tables and performs no catalog DDL, so `ensureChatThread`'s real-memory recall no longer intermittently fails with a `pg_class_relname_nsp_index` error instead of `/No thread found/`. A new Mastra-backed test file needs no extra setup; only a storage with a *different* schema/config would need its own pre-init.

**Confirm it's an infra race, not a regression:**

1. Run the failing test file **alone** — it should pass deterministically.
2. Run the **full suite** (`npm test`) — green (the same race may surface in a *different* file, so the single-file pass is the strong signal).
3. For a fully deterministic run, pass `--concurrency 1` to `remix test` to serialize DDL init — slower, but avoids the race when a new storage still performs its own DDL.

## Config-backed pool tradeoff: no `'error'` listener

Config-backed construction makes the driver own the pool internally (`this.#client = new pg.Pool(config)`), so `wipe()`/`reset()`/`close()` work — but the driver attaches **no** `pool.on('error')` listener and exposes no accessor (the postgres driver keeps `#client` private). Consequences:

- Server-side terminations of idle connections (Postgres restart, RDS failover, `pg_terminate_backend`) escape as an uncaught `'error'` and can crash the process. newapp sidesteps this by building the pool itself and attaching a listener.
- Passing your own `pg.Pool` to `createPostgresDatabase(pool)` re-enables the listener but disables `wipe()`/`reset()` (`#configOrThrow` throws "requires config-based construction"), which is why `test/setup.ts` resets the schema through a throwaway pool instead.
- The vendor CLI path (`createConfiguredDatabase` in `packages/cli/src/lib/commands/db.ts`) is config-backed too and has the same behavior — vendor-consistent, not a newapp regression.

## Gotchas (verified against vendor source)

- **`db.exec(sql, [])` cannot run multi-statement DDL.** It routes through the parameterized extended protocol, which rejects multi-statement scripts. Use `db.executeScript(sql)` (`database.ts:426`) — the simple-query path migrations use.
- **The runner's advisory lock replaces the old single-retry workaround.** `CREATE EXTENSION IF NOT EXISTS` in the retired `db/schema.sql` bootstrap was not serialized and could race on `pg_extension_name_index`; the runner's `withMigrationLock` now serializes concurrent boots and test workers, so no retry is needed.
- **A dry run and a rollback can disagree about an orphan** — down runs skip orphaned journal rows, forward runs abort on them. Prefer fixing the file or adopting a new journal over toggling between the two.

## When to Use

- App startup fails with `Migration checksum drift detected` or `Applied migration ... is missing from current migrations`.
- You need to edit or delete a previously-applied `data-table` migration, or revert applied migrations on a runner-based app.
- You are re-adopting the runner on a database that still has a legacy `data_table_migrations` journal.
- A test fails only with multiple files in parallel, with a `pg_class_…` / `pg_extension…` duplicate-key catalog error, and passes in isolation. For Mastra memory tests (`ensureChatThread`'s first `recall`), check that `test/setup.ts` still calls `initializeMastraStorage()`.
- An unhandled pool `'error'` crash surfaces under config-backed construction (fix: caller-owned pool with a listener, or a driver `onPoolError` option).
- Changing `db/migrations` baseline/migration DDL, `initializeAppDatabase()`, or test database reset behavior.
