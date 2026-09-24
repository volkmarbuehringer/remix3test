---
name: database-gotchas
description: "Use when working with Postgres from a Remix 3 app — DDL migrations on a dedicated client, data-table migration checksum drift recovery, constraint-violation error handling in controllers, and decoding raw-SQL (`db.exec`) rows with wire-honest schemas."
user-invocable: false
origin: consolidated
---

# Database Gotchas

**Consolidated from:** `ddl-migration-dedicated-client`, `data-table-migration-drift-recovery`, `remix-database-errors`, `remix3-raw-sql-wire-honest-rows`

This skill is the **index** for Postgres access deltas in a Remix 3 app. For the driver/data-table APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| DDL (CREATE/ALTER/CREATE INDEX/EXTENSION) times out on a shared `pg.Pool`, holds a pool connection, or causes lock contention / parallel-init self-deadlock; intermittent `pg_class_*` / `pg_extension_*` catalog duplicate-key in the full suite | `references/ddl-migration-dedicated-client.md` |
| App startup fails with `Migration checksum drift detected` or `Applied migration ... is missing from current migrations`; you need to edit, delete, or roll back an applied `data-table` migration | `references/migration-drift-recovery.md` |
| A controller catches a PostgreSQL constraint violation (`23001`/`23503`/`23505`/`23P01`), the adapter wraps the real error, or you must re-render the page with `formError` instead of returning JSON | `references/database-errors.md` |
| A raw `db.exec` query returns untyped rows and you are about to write `as unknown as SomeRow[]`; decoding `int4`/`int8`/aggregate/JSONB/UUID columns | `references/raw-sql-wire-honest-rows.md` |

## Core Rules

**DDL migrations on a dedicated client (`references/ddl-migration-dedicated-client.md`)**

- DDL run on a shared `pg.Pool` inherits the pool's `statement_timeout` (e.g. 30s), so long CREATE/ALTER dies during `beforeAll`/on constrained hardware, holds a pool connection for its whole duration, and can self-deadlock parallel domain init (e.g. Mastra `PostgresStoreVNext`). The fallback pattern is a dedicated `pg.Client` constructed with `statement_timeout: 0`, all DDL inside `BEGIN`/`COMMIT` for atomicity, a database-scoped session-level `pg_advisory_lock(287140921)`, and `client.end()` in `finally` (closing the connection releases any remaining session locks).
- Current newapp retires both that path and the data-table migration runner: `app/db.ts` builds the driver from a caller-owned `pg.Pool` (so it can attach a pool `'error'` listener) and bootstraps an idempotent `db/schema.sql` via `db.executeScript()` with no journal/checksum; `test/setup.ts` creates a fresh test DB, resets `public` through a throwaway pool, then calls `initializeAppDatabase()`. `db.executeScript()` uses the simple-query path (so it inherits pool `statement_timeout: 30000`), whereas `db.exec(sql, [])` cannot run multi-statement DDL (parameterized extended protocol rejects it). `CREATE EXTENSION IF NOT EXISTS` is **not** advisory-lock-serialized, so concurrent cold boots can race to a `pg_extension_name_index` duplicate key — the whole implicit-transaction script rolls back, making a single retry a safe no-op; `CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized and safe. A config-backed pool attaches **no** `pool.on('error')` listener, while passing your own `pg.Pool` re-enables the listener but disables `wipe()`/`reset()` — newapp now takes the caller-owned-pool route (which is why `test/setup.ts` resets the schema itself). An intermittent catalog duplicate (`pg_class_relname_nsp_index`/`pg_extension_name_index`) that passes when the file runs alone but varies across the full suite is an infra race — serialize DDL with `--concurrency 1`.

**Data-table migration checksum drift recovery (`references/migration-drift-recovery.md`)**

- `remix/data-table` journals each applied migration and checksums its `up.sql`. Editing an applied migration throws `Migration checksum drift detected for "<id>" (journal=<old>, current=<new>)` (`runner.ts:118`); deleting the migration file is worse — the orphaned `data_table_migrations` row throws `Applied migration "<id>_<name>" is missing from current migrations` (`runner.ts:110`). Forward runs hard-error on orphaned journal entries; only `down` runs ignore them (`runner.ts:104`).
- Recovery paths, preferred first: (1) revert the edit so the checksum matches; (2) `remix db rollback` (#11723) — newest-first, bounded by `--step <count>` (default `1`) or `--to <id>` (revert back *through* that migration, inclusive; bare id or `id_name` form), with `--dry-run` to preview; it is the supported replacement for raw journal surgery and stays possible with an orphaned entry, but an empty `--to ""` now throws `Unknown migration target: ""` and is **not** a "revert everything" hatch; (3) clear the journal (`DELETE FROM data_table_migrations;`, or drop the table) only as a last resort when the CLI is unavailable; (4) stop consulting the journal entirely — newapp's choice — by creating schema from an idempotent `db/schema.sql` through `db.executeScript()` (`initializeAppDatabase()` then `seed(db)`), so neither error can fire.

**Constraint violations and controller error handling (`references/database-errors.md`)**

- `@remix-run/data-table`'s `Database` layer wraps native `pg` errors in a `DataTableDatabaseError`, so the real PostgreSQL `code` lives on `.cause` (wrapper is `error.code = 'DATA_TABLE_DATABASE_ERROR'`). Use the repo's `app/utils/db-errors.ts` helpers, which walk the cause chain: `isConstraintViolation` matches `23001` (`RESTRICT_VIOLATION` — what `ON DELETE RESTRICT` produces) **and** `23503` (`FOREIGN_KEY_VIOLATION`), so always check both; `isUniqueViolation` matches `23505`; `isExclusionConstraintError` matches `23P01` and the `no_overlapping_seats`/`no_overlapping_offerings` constraints or a `conflicts with key` message. `Database.exec()` results also differ from `PoolQueryResult`: `result.rows` is nullable (`result.rows ?? []`), use `result.affectedRows ?? 0` (there is no `.rowCount`), and strict-cast through `unknown`.
- In destroy/update/create actions, catch the constraint violation and **re-render the page** with a `formError` banner and `status: 400` (see the admin grid pages) instead of returning JSON; log a structured, action-specific message ("creation"/"update"/"deletion") with the `code` rather than dumping the raw error, and re-throw unexpected errors. On the raw-SQL side, PostgreSQL `BIGINT`/`int8` arrives as a **string** through the `pg` driver, so wrap it in `Number()` before `new Date()`/strict comparisons/arithmetic; and when dates are stored as UTC-midnight epoch ms, filter against today's UTC midnight from `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())` — comparing to `Date.now()` (wall-clock) silently drops today's rows, and the expired filter is `< todayUtcMidnight`.

**Wire-honest raw-SQL row decoding (`references/raw-sql-wire-honest-rows.md`)**

- `db.exec` returns `rows?: Record<string, unknown>[]`, and force-casting that onto a hand-written interface lets the interface silently drift from the real pg wire shape (e.g. an `int4` SERIAL `id` typed `string` but returned as `number`; an `int8` `created_at` typed `number` but returned as `string`), with no compiler complaint because `unknown` accepts anything. Wrap `db.exec` in `queryRows`/`queryRow` helpers (`app/data/rows.ts`) that zod-parse every returned row and throw naming the statement + row index on mismatch; pass either the `sql` tag or `rawSql(text, values)` for dynamically built SQL. Keep the two row universes distinct: **wire rows** (raw `db.exec`, no `afterRead`/`parseIntFields` hooks, pg-native types) vs **domain rows** (typed `db.findMany`/`TableRow`, hooks applied, timestamps already `number`).
- Write wire-honest schemas that mirror pg instead of normalizing: `int4` (ids, `*_id`, `start_min`) → `z.number()`; `int8` (timestamps, `date`) → `z.string()`; aggregates over int8 (`count`/`min`/`max`/`sum`/`avg`) and `::numeric` results → `int8Aggregate` (`z.coerce.number()`); JSONB → `z.record(...)`/`z.array(...)`/`z.unknown()`; opaque bytea → `z.custom<Buffer>()`. **Check `db/schema.sql` first** — not every `id` is int4 (`webhook_requests.id` is `UUID` → `z.string()`). Replace hand-written interfaces with `type Row = z.output<typeof rowSchema>` as the single source of truth, and map wire → domain explicitly when a consumer needs numbers.

## When to Use

- You are writing or debugging any Postgres access in a Remix 3 app: DDL/migrations, constraint-violation handling in controllers, or raw `db.exec` queries.
- A migration timeout or catalog duplicate-key appears during test setup or concurrent boot; startup fails with a migration checksum-drift or orphaned-journal error; a delete/update throws a constraint violation and the action returns an unhelpful JSON 500; or raw-SQL rows have the wrong shapes (string `int8`, number `int4`, dropped "today" rows).
- Before adding a DDL migration, editing or deleting an applied migration, adding a controller catch around a write, or writing an aggregate/join via `db.exec`.

## Related Skills

- `postgres-gotchas` — the PostgreSQL quirks umbrella: idempotent FK alterations, `LIMIT` without `ORDER BY`, locale-dependent error matching, and the schema/validation side of `int8`-as-string
- `remix3-data-table` — the remix/data-table grid umbrella: typed `findMany`/`findOne`/`create` pitfalls, `inList()` filters, row adapters, and raw-SQL sort/filter grids
- `form-error-handling-remix3` — controller validation-failure re-renders (`parseSafe`, preserved values, per-field errors) that complement the DB-error `formError` re-render path
