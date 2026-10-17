---
name: remix3-data
description: "Use when working with remix/data-table grids/writes, database migrations, or Postgres from a Remix 3 app — typed db.findMany/findOne/create pitfalls (dynamic sort columns, unknown json/bigint columns, row adapters), write-returning (returnRow/returning: '*', zero-row update), inList() multi-ID filters, raw-SQL (sql/rawSql/db.exec) sort/filter grids, DDL migrations on a dedicated client, data-table migration checksum drift recovery, constraint-violation error handling in controllers, decoding db.exec rows with wire-honest zod schemas, idempotent FK alterations, LIMIT without ORDER BY, locale-dependent error matching, node-postgres returning int8 as strings, and index-drop safety (idx_scan = 0 is not proof)."
user-invocable: false
origin: consolidated
---

# Remix 3 Data: Data-Table, Migrations & Postgres

Consolidated from 3 former learned skills (`remix3-data-table`, `database-gotchas`, `postgres-gotchas`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| data-table grids/writes — inList(), dynamic sort columns, raw-SQL sort/filter, row adapters, write-returning | § Data-Table Grids & Writes | `references/remix3-data-table/` |
| Postgres from a Remix 3 app — DDL on a dedicated client, migration checksum drift, constraint violations, wire-honest db.exec decoding | § Database & Migrations | `references/database-gotchas/` |
| PostgreSQL quirks — idempotent FK alterations, LIMIT without ORDER BY, locale-dependent error matching, int8-as-string, index-drop safety | § Postgres | `references/postgres-gotchas/` |

## Data-Table Grids & Writes

_(formerly `remix3-data-table` — references live under `references/remix3-data-table/`)_

**Consolidated from:** `remix3-data-table-array-in-clause`, `remix3-data-table-dynamic-sort-order-by`, `remix3-data-table-raw-sql-sort-filter`, `remix3-data-table-row-adapter`

This skill is the **index** for data-table deltas. For the framework API and canonical query patterns, use `node_modules/remix/src/data-table/README.md` and `node_modules/remix/src/data-schema/README.md`.

The vendor guide `node_modules/remix/guides/08-data-and-validation.md` (authored as of rc.4) is canonical for the typed-API surface this skill does not restate: `table()`/`TableRow`/`primaryKey`, SQL migration files + `loadMigrations`/`db.migrate` + checksums, `databaseContext` middleware (`context.db`), form-data schemas (`f.object`/`f.field`/`f.fields`/`f.file(s)`, `s.defaulted`, `coerce.number()`), relations (`belongsTo`/`hasMany`/`hasOne`/`hasManyThrough` + `with`), `query()` values vs `db.query()` chains, the `sql` tag, lifecycle hooks (`validate`/`fail`, `beforeWrite`/`afterWrite`/`beforeDelete`/`afterDelete`/`afterRead`), `db.transaction`, and the SQLite/PostgreSQL/MySQL adapters — all under the guide's "Advanced data and validation" section. The rules below stay deltas because the guide does not cover them: `inList()` multi-ID filters, dynamic sort columns, raw-SQL sort/filter grids, and row adapters.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Querying by multiple IDs — `inList()` vs `= ANY($1)` order-preserving fallback | `references/remix3-data-table/array-in-clause.md` |
| `db.findMany({ orderBy })` rejecting a dynamic sort column (TS2322 OrderByTuple) | `references/remix3-data-table/dynamic-sort-order-by.md` |
| Raw-SQL grid (`sql`/`rawSql`/`db.exec`) needing safe sort + filter columns | `references/remix3-data-table/raw-sql-sort-filter.md` |
| `TableRow<typeof table>` won't assign to a UI row type (unknown json/bigint columns) | `references/remix3-data-table/row-adapter.md` |
| Insert/update needs the written row back, or an optimistic-concurrency update must detect a zero-row match | `references/remix3-data-table/write-returning.md` |

### Core Rules

- **Multi-ID filter**: `where: inList('id', ids)` (vendor operator). Fall back to `db.exec` + `= ANY($1)` + `array_position` only when the input-ID order must be preserved.
- **Dynamic sort column**: narrow to a `SORTABLE_FIELDS` union and cast (`as ListSortColumn`, not `as any`); add a stable `['id','desc']` tiebreaker.
- **Raw-SQL sort/filter**: whitelist column identifiers, build `ORDER BY`/`WHERE` as `rawSql` fragments, parameterize every value, and compile the direction with the vendor `compileOrderByDirection()` (`remix/data-table/sql-helpers`).
- **Typed-API rows**: own one canonical row interface plus one adapter that narrows `unknown` json/bigint columns at a single boundary — no `as unknown as` casts at call sites.
- **Return the written row at write time**: prefer `db.create(..., { returnRow: true })` / `createMany(..., { returnRows: true })` / the query-builder `.update(changes, { returning: '*' })` (returns `{ rows }`, no throw on zero rows) over `INSERT … RETURNING id` + re-select. Returned rows already ran `afterRead` — adapters on top must be idempotent; MySQL lacks `returning`.
- **Decode `db.exec` rows** with wire-honest zod schemas (int4→number, int8→string) — see `remix3-data § Database` (`references/database-gotchas/raw-sql-wire-honest-rows.md`).
- **`exactOptionalPropertyTypes`**: widen pass-through optionals to `| undefined` instead of fighting the strict flag.

### Related Skills

- `remix3-data § Database` — decoding `db.exec` rows with wire-honest zod schemas (`references/database-gotchas/raw-sql-wire-honest-rows.md`)
- `remix3-data § Database` — `DataTableDatabaseError` cause unwrapping and PG error codes (`references/database-gotchas/database-errors.md`)
- `dev-gotchas § TypeScript` (`references/typescript-gotchas/exact-optional-property-types.md`) — the general `exactOptionalPropertyTypes` widening pattern

---

## Database & Migrations

_(formerly `database-gotchas` — references live under `references/database-gotchas/`)_

**Consolidated from:** `ddl-migration-dedicated-client`, `data-table-migration-drift-recovery`, `remix-database-errors`, `remix3-raw-sql-wire-honest-rows`

This skill is the **index** for Postgres access deltas in a Remix 3 app. For the driver/data-table APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

The vendor guide `node_modules/remix/guides/08-data-and-validation.md` (authored as of rc.4) is canonical for the basics this skill does not restate: migration files + checksum journaling, `createPostgresDatabase({ connectionString })`, and `db.transaction({ isolationLevel: "serializable" })` (§"Create the tables with SQL", §"Use PostgreSQL or MySQL"). The deltas below stay here because the guide cannot know them: dedicated-client DDL, checksum-drift/orphaned-journal recovery, constraint-error cause unwrapping, and wire-honest `db.exec` row decoding.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| DDL (CREATE/ALTER/CREATE INDEX/EXTENSION) times out on a shared `pg.Pool`, holds a pool connection, or causes lock contention / parallel-init self-deadlock; intermittent `pg_class_*` / `pg_extension_*` catalog duplicate-key in the full suite | `references/database-gotchas/ddl-migration-dedicated-client.md` |
| App startup fails with `Migration checksum drift detected` or `Applied migration ... is missing from current migrations`; you need to edit, delete, or roll back an applied `data-table` migration | `references/database-gotchas/migration-drift-recovery.md` |
| A controller catches a PostgreSQL constraint violation (`23001`/`23503`/`23505`/`23P01`), the adapter wraps the real error, or you must re-render the page with `formError` instead of returning JSON | `references/database-gotchas/database-errors.md` |
| A raw `db.exec` query returns untyped rows and you are about to write `as unknown as SomeRow[]`; decoding `int4`/`int8`/aggregate/JSONB/UUID columns | `references/database-gotchas/raw-sql-wire-honest-rows.md` |

### Core Rules

**DDL migrations on a dedicated client (`references/database-gotchas/ddl-migration-dedicated-client.md`)**

- DDL run on a shared `pg.Pool` inherits the pool's `statement_timeout` (e.g. 30s), so long CREATE/ALTER dies during `beforeAll`/on constrained hardware, holds a pool connection for its whole duration, and can self-deadlock parallel domain init (e.g. Mastra `PostgresStoreVNext`). The fallback pattern is a dedicated `pg.Client` constructed with `statement_timeout: 0`, all DDL inside `BEGIN`/`COMMIT` for atomicity, a database-scoped session-level `pg_advisory_lock(287140921)`, and `client.end()` in `finally` (closing the connection releases any remaining session locks).
- Current newapp retires both that path and the data-table migration runner: `app/db.ts` builds the driver from a caller-owned `pg.Pool` (so it can attach a pool `'error'` listener) and bootstraps an idempotent `db/schema.sql` via `db.executeScript()` with no journal/checksum; `test/setup.ts` creates a fresh test DB, resets `public` through a throwaway pool, then calls `initializeAppDatabase()`. `db.executeScript()` uses the simple-query path (so it inherits pool `statement_timeout: 30000`), whereas `db.exec(sql, [])` cannot run multi-statement DDL (parameterized extended protocol rejects it). `CREATE EXTENSION IF NOT EXISTS` is **not** advisory-lock-serialized, so concurrent cold boots can race to a `pg_extension_name_index` duplicate key — the whole implicit-transaction script rolls back, making a single retry a safe no-op; `CREATE TABLE/INDEX IF NOT EXISTS` are catalog-lock-serialized and safe. A config-backed pool attaches **no** `pool.on('error')` listener, while passing your own `pg.Pool` re-enables the listener but disables `wipe()`/`reset()` — newapp now takes the caller-owned-pool route (which is why `test/setup.ts` resets the schema itself). An intermittent catalog duplicate (`pg_class_relname_nsp_index`/`pg_extension_name_index`) that passes when the file runs alone but varies across the full suite is an infra race — serialize DDL with `--concurrency 1`.

**Data-table migration checksum drift recovery (`references/database-gotchas/migration-drift-recovery.md`)**

- `remix/data-table` journals each applied migration and checksums its `up.sql`. Editing an applied migration throws `Migration checksum drift detected for "<id>" (journal=<old>, current=<new>)` (`runner.ts:118`); deleting the migration file is worse — the orphaned `data_table_migrations` row throws `Applied migration "<id>_<name>" is missing from current migrations` (`runner.ts:110`). Forward runs hard-error on orphaned journal entries; only `down` runs ignore them (`runner.ts:105`).
- Recovery paths, preferred first: (1) revert the edit so the checksum matches; (2) `remix db rollback` (#11723) — newest-first, bounded by `--step <count>` (default `1`) or `--to <id>` (revert back *through* that migration, inclusive; bare id or `id_name` form), with `--dry-run` to preview; it is the supported replacement for raw journal surgery and stays possible with an orphaned entry, but an empty `--to ""` now throws `Unknown migration target: ""` and is **not** a "revert everything" hatch; (3) clear the journal (`DELETE FROM data_table_migrations;`, or drop the table) only as a last resort when the CLI is unavailable; (4) stop consulting the journal entirely — newapp's choice — by creating schema from an idempotent `db/schema.sql` through `db.executeScript()` (`initializeAppDatabase()` then `seed(db)`), so neither error can fire.

**Constraint violations and controller error handling (`references/database-gotchas/database-errors.md`)**

- `@remix-run/data-table`'s `Database` layer wraps native `pg` errors in a `DataTableDatabaseError`, so the real PostgreSQL `code` lives on `.cause` (wrapper is `error.code = 'DATA_TABLE_DATABASE_ERROR'`). Use the repo's `app/utils/db-errors.ts` helpers, which walk the cause chain: `isConstraintViolation` matches `23001` (`RESTRICT_VIOLATION` — what `ON DELETE RESTRICT` produces) **and** `23503` (`FOREIGN_KEY_VIOLATION`), so always check both; `isUniqueViolation` matches `23505`; `isExclusionConstraintError` matches `23P01` and the `no_overlapping_seats`/`no_overlapping_offerings` constraints or a `conflicts with key` message. `Database.exec()` results also differ from `PoolQueryResult`: `result.rows` is nullable (`result.rows ?? []`), use `result.affectedRows ?? 0` (there is no `.rowCount`), and strict-cast through `unknown`.
- In destroy/update/create actions, catch the constraint violation and **re-render the page** with a `formError` banner and `status: 400` (see the admin grid pages) instead of returning JSON; log a structured, action-specific message ("creation"/"update"/"deletion") with the `code` rather than dumping the raw error, and re-throw unexpected errors. On the raw-SQL side, PostgreSQL `BIGINT`/`int8` arrives as a **string** through the `pg` driver, so wrap it in `Number()` before `new Date()`/strict comparisons/arithmetic; and when dates are stored as UTC-midnight epoch ms, filter against today's UTC midnight from `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())` — comparing to `Date.now()` (wall-clock) silently drops today's rows, and the expired filter is `< todayUtcMidnight`.

**Wire-honest raw-SQL row decoding (`references/database-gotchas/raw-sql-wire-honest-rows.md`)**

- `db.exec` returns `rows?: Record<string, unknown>[]`, and force-casting that onto a hand-written interface lets the interface silently drift from the real pg wire shape (e.g. an `int4` SERIAL `id` typed `string` but returned as `number`; an `int8` `created_at` typed `number` but returned as `string`), with no compiler complaint because `unknown` accepts anything. Wrap `db.exec` in `queryRows`/`queryRow` helpers (`app/data/rows.ts`) that zod-parse every returned row and throw naming the statement + row index on mismatch; pass either the `sql` tag or `rawSql(text, values)` for dynamically built SQL. Keep the two row universes distinct: **wire rows** (raw `db.exec`, no `afterRead`/`parseIntFields` hooks, pg-native types) vs **domain rows** (typed `db.findMany`/`TableRow`, hooks applied, timestamps already `number`).
- Write wire schemas that validate the pg shape: `int4` (ids, `*_id`, `start_min`) → `z.number()`; `int8` (timestamps, `date`) → `int8` (`z.coerce.number()`, `app/data/rows.ts`) so raw and typed-API reads agree on a number; aggregates over int8 (`count`/`min`/`max`/`sum`/`avg`) and `::numeric` results → `int8Aggregate` (`z.coerce.number()`); JSONB → `z.record(...)`/`z.array(...)`/`z.unknown()`; opaque bytea → `z.custom<Buffer>()`. **Check `db/schema.sql` first** — not every `id` is int4 (`webhook_requests.id` is `UUID` → `z.string()`). Replace hand-written interfaces with `type Row = z.output<typeof rowSchema>` as the single source of truth.

### When to Use

- You are writing or debugging any Postgres access in a Remix 3 app: DDL/migrations, constraint-violation handling in controllers, or raw `db.exec` queries.
- A migration timeout or catalog duplicate-key appears during test setup or concurrent boot; startup fails with a migration checksum-drift or orphaned-journal error; a delete/update throws a constraint violation and the action returns an unhelpful JSON 500; or raw-SQL rows have the wrong shapes (string `int8`, number `int4`, dropped "today" rows).
- Before adding a DDL migration, editing or deleting an applied migration, adding a controller catch around a write, or writing an aggregate/join via `db.exec`.

### Related Skills

- `remix3-data § Postgres` — the PostgreSQL quirks umbrella: idempotent FK alterations, `LIMIT` without `ORDER BY`, locale-dependent error matching, and the schema/validation side of `int8`-as-string
- `remix3-data § Data-Table` — the remix/data-table grid umbrella: typed `findMany`/`findOne`/`create` pitfalls, `inList()` filters, row adapters, and raw-SQL sort/filter grids
- `remix3-forms § Validation Errors` — controller validation-failure re-renders (`parseSafe`, preserved values, per-field errors) that complement the DB-error `formError` re-render path

---

## Postgres

_(formerly `postgres-gotchas` — references live under `references/postgres-gotchas/`)_

**Consolidated from:** `postgres-idempotent-fk-alteration`, `postgres-limit-without-order`, `postgres-locale-error-matching`

Covers five PostgreSQL pitfalls:
1. Idempotent FK constraint alteration (`ON DELETE` behavior changes)
2. `LIMIT 1` without `ORDER BY` is non-deterministic
3. Locale-dependent error message matching breaking JS libraries
4. node-postgres returning `BIGINT`/`int8` columns as strings
5. Judging index liveness/redundancy before dropping one

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Changing an existing FK `ON DELETE` behavior in an idempotent migration | `references/postgres-gotchas/idempotent-fk-alteration.md` |
| A test helper or query relying on a "first" or "default" row (`LIMIT 1`) | `references/postgres-gotchas/limit-without-order-by.md` |
| A Postgres library crashing because its error-text regex assumes English | `references/postgres-gotchas/locale-dependent-error-matching.md` |
| A Zod / Mastra `outputSchema` expecting `number` for an `int8`/`BIGINT` column | `references/postgres-gotchas/int8-returned-as-string.md` |
| A review proposes dropping an index, or `pg_stat_user_indexes.idx_scan` is 0 | `references/postgres-gotchas/index-drop-safety.md` |

### Core Rules

- **Idempotent FK change**: `DROP CONSTRAINT IF EXISTS`, then re-`ADD` inside a `DO $$` block guarded by `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`; `ON DELETE SET NULL` requires the column to be nullable first. Run it under a lock / in one migration transaction.
- **`LIMIT` always travels with `ORDER BY`** (or a filtering `WHERE`); otherwise the row is arbitrary and tests fail intermittently as data accumulates.
- **Error text is locale-dependent**: set `lc_messages = 'en_US.UTF-8'` at the database or connection level so English-matching dependencies work. Session-level `SET` races on pooled clients.
- **`pg` returns `int8`/`BIGINT` as strings, `int4` as numbers**: decode at the boundary with `z.coerce.number()` (the shared `int8` schema in `app/data/rows.ts`) rather than leaving `z.number()` — and never `z.any()`/`z.union([z.number(), z.string()])`, which hide the split and erase a Mastra `outputSchema` contract.
- **Zod 4 records**: `z.record(keySchema, valueSchema)` — the one-arg `z.record(valueSchema)` is a TS2554.
- **`idx_scan = 0` is not evidence an index is unused**: on a small table the planner seq-scans, so every index reads 0 — pair it with the row count, and grep the **whole repo** (not just the query layer) for the column and its `ILIKE`/`LIKE` operators before dropping a trigram index. When de-duplicating, group `pg_index` by access method too (`ca.relam = cb.relam`), or a `UNIQUE` btree and a GIN trigram index on one column look identical; a `UNIQUE` constraint already owns its btree, so a second `CREATE INDEX` on that column is the real redundancy.

### When to Use

- Writing idempotent migrations that alter FK `ON DELETE` behavior
- Writing test helpers or queries that rely on a "first" or "default" row
- Debugging intermittent test failures or library crashes caused by Postgres error text
- Any time a Postgres-dependent JS/TS library behaves differently across environments with different locales
- Reviewing which indexes to keep or drop, or any time `pg_stat_user_indexes.idx_scan` is 0
- A schema validates at typecheck but fails at runtime on the DB-backed path

### Related Skills

- `mastra-deltas § Agent` — Mastra agent patterns, including PostgresStore observability and storage-API cleanup
- `remix3-data § Database` — DDL migrations on a dedicated `pg.Client` and migration checksum-drift recovery (`references/database-gotchas/ddl-migration-dedicated-client.md`)
- `postgres-patterns` — general PostgreSQL schema, query, and indexing patterns
- `database-reviewer` — the review workflow that surfaces `pg_stat_user_indexes`; apply this reference's caveat before acting on a 0-scan row
