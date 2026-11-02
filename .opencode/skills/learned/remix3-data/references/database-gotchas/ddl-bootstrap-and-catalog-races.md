# DDL Bootstrap and Catalog Races

**Source:** `ddl-migration-dedicated-client` (renamed 2026-10-24)
**Extracted:** 2026-07-17
**Updated:** 2026-11-02 (removed the retired `db/schema.sql` bootstrap recipe; the app runs the `remix/data-table` runner with a single idempotent baseline and a distinct `app_migrations` journal)
**Context:** DDL in test/bootstrap setup that contends on the pool `statement_timeout`, or intermittent Postgres catalog duplicate-key errors during parallel init.

## Current state in newapp (2026-11)

newapp runs SQL-file migrations from `db/migrations/` through the `remix/data-table` runner:

- `app/db.ts` builds a caller-owned `pg.Pool`, attaches an `'error'` listener, then calls `db.migrate(await loadMigrations('../db/migrations'), { journalTable: 'app_migrations' })` and `seed(db)`. `remix.json` records the same journal under `db.migrations.journalTable`.
- `db/migrations/20261101000000_baseline/up.sql` is the full, idempotent schema. An existing database runs it once and the journal records it; fresh databases create everything from it.
- The runner holds a Postgres advisory lock for the whole run (`withMigrationLock`), so parallel test workers and concurrent cold boots serialize instead of racing `pg_extension_name_index`. The old single-retry workaround is no longer needed.
- Applied migrations are immutable: the runner checksums `up.sql` and fails the next boot on drift or a missing journal entry (see `migration-drift-recovery.md`).
- `test/setup.ts` creates a fresh test database, drops `public` through a throwaway pool, then calls `initializeAppDatabase()`; every run therefore exercises the same migrations as production.

## Retired: idempotent `db/schema.sql` bootstrap (2026-08 – 2026-10)

The app previously built the schema from a `db/schema.sql` script through `db.executeScript()` with no journal or checksum, and retried the script once when two cold boots raced on `CREATE EXTENSION IF NOT EXISTS`. That bootstrap was retired on 2026-11-01 and **`db/schema.sql` no longer exists**. The runner's advisory lock now covers the race, so neither the schema file nor the retry belongs in a recovery path. Do not reintroduce them, and do not reintroduce a dedicated `pg.Client` migration path; the runner it worked around is gone.

### Diagnosing an intermittent catalog duplicate-key in tests

`initializeAppDatabase()` / Mastra `PostgresStoreVNext` runs DDL on the shared local test DB. When several test files each init the store concurrently (default parallel workers), their `CREATE TABLE/EXTENSION` can collide on the Postgres **catalog**, surfacing as an intermittent `duplicate key value violates unique constraint "pg_class_relname_nsp_index"` (or the sibling `pg_extension_name_index`). The failing test **varies between runs** — it is whichever worker happened to race, not a logic bug in the code under test.

**Mastra's shared schema is now pre-initialized once.** `test/setup.ts`'s `initializeMastraStorage()` builds a throwaway `PostgresStoreVNext` with the same config as `app/actions/mastra/storage.ts` (id `mastra`, public schema) and calls `init()` before any worker forks. Workers' lazy auto-init then finds the tables and performs no catalog DDL, so `ensureChatThread`'s real-memory recall no longer intermittently fails with a `pg_class_relname_nsp_index` error instead of `/No thread found/`. A new Mastra-backed test file needs no extra setup; only a storage with a *different* schema/config would need its own pre-init.

**Confirm it's an infra race, not a regression:**
1. Run the failing test file **alone** — it should pass deterministically.
2. Run the **full suite** (`npm test`) — green (the same race may surface in a *different* file, so the single-file pass is the strong signal).
3. For a fully deterministic run, pass `--concurrency 1` to `remix test` to serialize DDL init — slower, but avoids the race when a new storage still performs its own DDL.

### Config-backed pool tradeoff: no `'error'` listener

Config-backed construction makes the driver own the pool internally (`this.#client = new pg.Pool(config)`), so `wipe()`/`reset()`/`close()` work — but the driver attaches **no `pool.on('error')` listener** and exposes no accessor (all 760 lines of the postgres driver keep `#client` private). Consequences:

- Server-side terminations of idle connections (Postgres restart, RDS failover, `pg_terminate_backend`) escape as an uncaught `'error'` and can crash the process. newapp sidesteps this by building the pool itself and attaching a listener.
- Passing your own `pg.Pool` to `createPostgresDatabase(pool)` re-enables the listener but disables `wipe()`/`reset()` (`#configOrThrow` throws "requires config-based construction"), which is why `test/setup.ts` resets the schema through a throwaway pool instead.
- The vendor CLI path (`createConfiguredDatabase` in `packages/cli/src/lib/commands/db.ts`) is config-backed too and has the same behavior — vendor-consistent, not a newapp regression.

## When to Use

- A test fails only with multiple files in parallel, with a `pg_class_…` / `pg_extension…` duplicate-key catalog error, and passes in isolation. For Mastra memory tests (`ensureChatThread`'s first `recall`), check that `test/setup.ts` still calls `initializeMastraStorage()`.
- An unhandled pool `'error'` crash surfaces under config-backed construction (fix: caller-owned pool with a listener, or a driver `onPoolError` option).
- Changing `db/migrations` baseline/migration DDL, `initializeAppDatabase()`, or test database reset behavior.
