# DDL Bootstrap and Catalog Races

**Source:** `ddl-migration-dedicated-client` (renamed 2026-10-24)
**Extracted:** 2026-07-17
**Updated:** 2026-08-18 (newapp switched from `db.migrate()`/`db.reset()` to an idempotent `db/schema.sql` bootstrap via `db.executeScript()`; the dedicated-client migration workaround was retired)
**Context:** DDL in test/bootstrap setup that contends on the pool `statement_timeout`, or intermittent Postgres catalog duplicate-key errors during parallel init.

## Current state in newapp (2026-08)

newapp builds the Postgres database from a **caller-owned** `pg.Pool` in `app/db.ts` (so the pool can attach an `'error'` handler) and bootstraps the schema from an idempotent `db/schema.sql`:

- `initializeAppDatabase()` runs `db.executeScript(await loadAppSchema())` then `seed(db)`. `db/schema.sql` uses `CREATE TABLE/INDEX/EXTENSION IF NOT EXISTS`, so startup is a no-op when tables already exist.
- There is **no migration journal** and no checksum tracking. `db.migrate()`/`db.reset({ migrations, seed })`/`loadAppMigrations()` are not used; `db/migrations/` and `remix.json`'s `db.migrations.directory` were removed.
- `db.executeScript()` runs the multi-statement script via the driver's simple-query path on the caller-owned app pool, so DDL inherits the pool `statement_timeout: 30000`. `db.exec(sql, [])` cannot be used instead — it routes through the parameterized extended protocol, which rejects multi-statement scripts.
- `CREATE EXTENSION IF NOT EXISTS` is **not advisory-lock-serialized**. Two instances cold-booting an empty catalog can race and one fails with a `pg_extension_name_index` duplicate-key error; the whole implicit-transaction script rolls back, so a single retry in `initializeAppDatabase()` is a safe no-op. `CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized and safe under concurrency.
- `test/setup.ts` creates a fresh test DB, drops/recreates `public` through a throwaway pool (config-only `db.wipe()` is unavailable on the caller-owned pool), then calls `initializeAppDatabase()`.

Do not reintroduce a dedicated `pg.Client` migration path for this app; the runner it worked around is gone.

### Diagnosing an intermittent catalog duplicate-key in tests

`initializeAppDatabase()` / Mastra `PostgresStoreVNext` runs DDL on the shared local test DB. When several test files each init the store concurrently (default parallel workers), their `CREATE TABLE/EXTENSION` can collide on the Postgres **catalog**, surfacing as an intermittent `duplicate key value violates unique constraint "pg_class_relname_nsp_index"` (or the sibling `pg_extension_name_index`). The failing test **varies between runs** — it is whichever worker happened to race, not a logic bug in the code under test.

**Mastra's shared schema is now pre-initialized once.** `test/setup.ts`'s `initializeMastraStorage()` builds a throwaway `PostgresStoreVNext` with the same config as `app/actions/mastra/storage.ts` (id `mastra`, public schema) and calls `init()` before any worker forks. Workers' lazy auto-init then finds the tables and performs no catalog DDL, so `ensureChatThread`'s real-memory recall no longer intermittently fails with a `pg_class_relname_nsp_index` error instead of `/No thread found/`. A new Mastra-backed test file needs no extra setup; only a storage with a *different* schema/config would need its own pre-init.

**Confirm it's an infra race, not a regression:**
1. Run the failing test file **alone** — it should pass deterministically.
2. Run the **full suite** (`npm test`) — green (the same race may surface in a *different* file, so the single-file pass is the strong signal).
3. For a fully deterministic run, pass `--concurrency 1` to `remix test` to serialize DDL init — slower, but avoids the race.

### Config-backed pool tradeoff: no `'error'` listener

Config-backed construction makes the driver own the pool internally (`this.#client = new pg.Pool(config)`), so `wipe()`/`reset()`/`close()` work — but the driver attaches **no `pool.on('error')` listener** and exposes no accessor (all 760 lines of the postgres driver keep `#client` private). Consequences:

- Server-side terminations of idle connections (Postgres restart, RDS failover, `pg_terminate_backend`) escape as an uncaught `'error'` and can crash the process. newapp sidesteps this by building the pool itself and attaching a listener.
- Passing your own `pg.Pool` to `createPostgresDatabase(pool)` re-enables the listener but disables `wipe()`/`reset()` (`#configOrThrow` throws "requires config-based construction"), which is why `test/setup.ts` resets the schema through a throwaway pool instead.
- The vendor CLI path (`createConfiguredDatabase` in `packages/cli/src/lib/commands/db.ts`) is config-backed too and has the same behavior — vendor-consistent, not a newapp regression.

## When to Use

- A test fails only with multiple files in parallel, with a `pg_class_…` / `pg_extension…` duplicate-key catalog error, and passes in isolation. For Mastra memory tests (`ensureChatThread`'s first `recall`), check that `test/setup.ts` still calls `initializeMastraStorage()`.
- An unhandled pool `'error'` crash surfaces under config-backed construction (fix: caller-owned pool with a listener, or a driver `onPoolError` option).
- Changing `db/schema.sql` bootstrap DDL, `initializeAppDatabase()`, or test database reset behavior.
