---
name: remix3-data
description: "Use when working with remix/data-table grids/writes, database migrations, Postgres, or forms from a Remix 3 app — typed db.findMany/findOne/create pitfalls (dynamic sort columns, unknown json/bigint columns, row adapters), counting filtered rows (`db.count` typed where / grid totals), write-returning (returnRow/returning: '*', zero-row update), partial-write hook ordering (beforeWrite→validate), inList() multi-ID filters, raw-SQL (sql/rawSql/db.exec) sort/filter grids, migration baseline/catalog races (db/migrations, parallel test init), data-table migration checksum drift recovery and legacy-journal re-adoption, constraint-violation error handling in controllers, decoding db.exec rows with wire-honest zod schemas, idempotent FK alterations, LIMIT without ORDER BY, locale-dependent error matching, node-postgres returning int8 as strings, index-drop safety (idx_scan = 0 is not proof), and form handling/validation — data-schema top-level s.optional(), s.defaulted() returning its default without running the wrapped schema, parseSafe direct re-render with preserved values and per-field errors, coerce/select pitfalls and the empty-string select fallback, multi-source field precedence (custom-over-select), announcing and focusing server-rendered errors, admin grid state on validation failure, delete confirmation via capture-phase delegation or an in-app alertdialog with requestConfirm reuse, password security/toggle, session.flash soft-fork routing, a session value mutated in place that never persists, and native form fallbacks on SSE-backed agent routes (approve/decline, ask_user questions, and message turns without JS)."
user-invocable: false
origin: consolidated
---

# Remix 3 Data: Data-Table, Migrations, Postgres & Forms

Consolidated from 5 former learned skills (`remix3-data-table`, `database-gotchas`, `postgres-gotchas`, `remix-forms`, `form-error-handling-remix3`) between 2026-10-17 and 2026-11-02. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| data-table grids/writes — inList(), dynamic sort columns, raw-SQL sort/filter, row adapters, write-returning | § Data-Table Grids & Writes | `references/remix3-data-table/` |
| Postgres from a Remix 3 app — DDL bootstrap/catalog races, migration checksum drift, constraint violations, wire-honest db.exec decoding | § Database & Migrations | `references/database-gotchas/` |
| PostgreSQL quirks — idempotent FK alterations, LIMIT without ORDER BY, locale-dependent error matching, int8-as-string, index-drop safety | § Postgres | `references/postgres-gotchas/` |
| Forms/data — s.optional(), delete confirmation, password forms, session.flash soft-fork routing, non-persisting session values, native forms on SSE-backed agent routes | § Forms & Mutations | `references/remix-forms/` |
| Form validation errors — parseSafe re-render, preserved values, per-field errors, coerce/select pitfalls, empty-string select fallback, admin grid state | § Validation Errors | `references/form-error-handling-remix3/` |

## Data-Table Grids & Writes

_(formerly `remix3-data-table` — references live under `references/remix3-data-table/`)_

**Consolidated from:** `remix3-data-table-array-in-clause`, `remix3-data-table-dynamic-sort-order-by`, `remix3-data-table-count-with-typed-where`, `remix3-data-table-raw-sql-sort-filter`, `remix3-data-table-row-adapter`, `remix3-data-table-write-returning`, `remix3-data-table-partial-writes-and-hooks`

This skill is the **index** for data-table deltas. For the framework API and canonical query patterns, use `node_modules/remix/src/data-table/README.md` and `node_modules/remix/src/data-schema/README.md`.

The vendor guide `node_modules/remix/guides/08-data-and-validation.md` (authored as of rc.4) is canonical for the typed-API surface this skill does not restate: `table()`/`TableRow`/`primaryKey`, SQL migration files + `loadMigrations`/`db.migrate` + checksums, `databaseContext` middleware (`context.db`), form-data schemas (`f.object`/`f.field`/`f.fields`/`f.file(s)`, `s.defaulted`, `coerce.number()`), relations (`belongsTo`/`hasMany`/`hasOne`/`hasManyThrough` + `with`), `query()` values vs `db.query()` chains, the `sql` tag, lifecycle hooks (`validate`/`fail`, `beforeWrite`/`afterWrite`/`beforeDelete`/`afterDelete`/`afterRead`), `db.transaction`, and the SQLite/PostgreSQL/MySQL adapters — all under the guide's "Advanced data and validation" section. The rules below stay deltas because the guide does not cover them: `inList()` multi-ID filters, dynamic sort columns, raw-SQL sort/filter grids, and row adapters.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Querying by multiple IDs (`inList()`), a dynamic `orderBy` column (TS2322), or `db.count` rejecting a shared `WhereInput` (TS2345) | `references/remix3-data-table/query-patterns.md` |
| Raw-SQL grid (`sql`/`rawSql`/`db.exec`) needing safe sort + filter columns | `references/remix3-data-table/raw-sql-sort-filter.md` |
| `TableRow<typeof table>` won't assign to a UI row type (unknown json/bigint columns) | `references/remix3-data-table/row-adapter.md` |
| Insert/update needs the written row back, or an optimistic-concurrency update must detect a zero-row match | `references/remix3-data-table/write-returning.md` |
| A `validate`/`beforeWrite` hook silently passes, a one-sided paired-column update throws `DataTableConstraintError`, or required fields fail every partial `db.update` | `references/remix3-data-table/partial-writes-and-hooks.md` |

### Core Rules

**Query patterns (`references/remix3-data-table/query-patterns.md`)**

- **Multi-ID filter**: `where: inList('id', ids)` (vendor operator). Fall back to `db.exec` + `= ANY($1)` + `array_position` only when the input-ID order must be preserved.
- **Dynamic sort column**: narrow to a `SORTABLE_FIELDS` union and cast (`as ListSortColumn`, not `as any`); add a stable `['id','desc']` tiebreaker.
- **Raw-SQL sort/filter**: whitelist column identifiers, build `ORDER BY`/`WHERE` as `rawSql` fragments, parameterize every value, and compile the direction with the vendor `compileOrderByDirection()` (`remix/data-table/sql-helpers`).
- **Typed-API rows**: own one canonical row interface plus one adapter that narrows `unknown` json/bigint columns at a single boundary — no `as unknown as` casts at call sites.
- **Partial writes vs hooks**: `validate` receives the `beforeWrite`-normalized payload — check derived columns (not stripped inputs) and gate required fields on `operation === 'create'`; merge one-sided paired-column updates before writing. See `references/remix3-data-table/partial-writes-and-hooks.md`.
- **Filtered totals**: type a predicate used by both a grid query and `db.count` as `SingleTableWhere<typeof table>`; the broader `WhereInput` passes `findMany`/`paginate` but fails `CountOptions` with TS2345. `db.count` accepts the same `where`; `paginate()` needs a separate count, and shared error re-renders must carry the total through their loader.
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

The vendor guide `node_modules/remix/guides/08-data-and-validation.md` (authored as of rc.4) is canonical for the basics this skill does not restate: migration files + checksum journaling, `createPostgresDatabase({ connectionString })`, and `db.transaction({ isolationLevel: "serializable" })` (§"Create the tables with SQL", §"Use PostgreSQL or MySQL"). The deltas below stay here because the guide cannot know them: caller-owned-pool DDL and advisory-lock serialization, checksum-drift/orphaned-journal recovery, constraint-error cause unwrapping, and wire-honest `db.exec` row decoding.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Migration baseline via `db/migrations`, checksum drift/orphaned journal, `remix db rollback`, legacy-journal adoption, parallel-init catalog duplicate-key, or a config-backed pool without an `'error'` listener | `references/database-gotchas/migrations.md` |
| A controller catches a PostgreSQL constraint violation (`23001`/`23503`/`23505`/`23P01`), the adapter wraps the real error, or you must re-render the page with `formError` instead of returning JSON | `references/database-gotchas/database-errors.md` |
| A raw `db.exec` query returns untyped rows and you are about to write `as unknown as SomeRow[]`; decoding `int4`/`int8`/aggregate/JSONB/UUID columns | `references/database-gotchas/raw-sql-wire-honest-rows.md` |

### Core Rules

**Migrations, drift, and DDL races (`references/database-gotchas/migrations.md`)**

- newapp builds the driver from a caller-owned `pg.Pool` (so it can attach a pool `'error'` listener) and runs `db/migrations` through `db.migrate(..., { journalTable: 'app_migrations' })`; `test/setup.ts` creates a fresh test DB, resets `public` through a throwaway pool, then calls `initializeAppDatabase()`. The baseline `20261101000000_baseline/up.sql` is idempotent, and the runner's advisory lock serializes parallel workers/cold boots. A config-backed pool attaches **no** `pool.on('error')` listener; passing your own `pg.Pool` re-enables it but disables `wipe()`/`reset()` — newapp takes the caller-owned-pool route. The retired `db/schema.sql` bootstrap and dedicated-`pg.Client` migration path must not be reintroduced.
- `remix/data-table` journals each applied migration and checksums its `up.sql`. Editing an applied migration throws `Migration checksum drift detected ...` (`runner.ts:118-123`); deleting it throws `Applied migration ... is missing from current migrations` (`runner.ts:110`). Forward runs hard-error on orphans; only `down` runs ignore them (`runner.ts:105`).
- Recovery, preferred first: revert the edit; `remix db rollback` (`--step`/`--to`/`--dry-run`, orphan-tolerant; an empty `--to ""` throws); clear the journal only as a last resort.
- **Adoption over a legacy journal:** isolate the runner in a distinct `journalTable`, make the first migration an idempotent baseline, keep `data_table_migrations` untouched, and test orphan adoption + `loadConfig()` parity.
- An intermittent catalog duplicate (`pg_class_relname_nsp_index`/`pg_extension_name_index`) that passes alone but varies across the suite is an infra race: pre-initialize shared storage (Mastra does this in `test/setup.ts`) or serialize DDL with `--concurrency 1`.

**Constraint violations and controller error handling (`references/database-gotchas/database-errors.md`)**

- `@remix-run/data-table`'s `Database` layer wraps native `pg` errors in a `DataTableDatabaseError`, so the real PostgreSQL `code` lives on `.cause` (wrapper is `error.code = 'DATA_TABLE_DATABASE_ERROR'`). Use the repo's `app/utils/db-errors.ts` helpers, which walk the cause chain: `isConstraintViolation` matches `23001` (`RESTRICT_VIOLATION` — what `ON DELETE RESTRICT` produces) **and** `23503` (`FOREIGN_KEY_VIOLATION`), so always check both; `isUniqueViolation` matches `23505`; `isExclusionConstraintError` matches `23P01` and the `no_overlapping_seats`/`no_overlapping_offerings` constraints or a `conflicts with key` message. `Database.exec()` results also differ from `PoolQueryResult`: `result.rows` is nullable (`result.rows ?? []`), use `result.affectedRows ?? 0` (there is no `.rowCount`), and strict-cast through `unknown`.
- In destroy/update/create actions, catch the constraint violation and **re-render the page** with a `formError` banner and `status: 400` (see the admin grid pages) instead of returning JSON; log a structured, action-specific message ("creation"/"update"/"deletion") with the `code` rather than dumping the raw error, and re-throw unexpected errors. On the raw-SQL side, PostgreSQL `BIGINT`/`int8` arrives as a **string** through the `pg` driver, so wrap it in `Number()` before `new Date()`/strict comparisons/arithmetic; and when dates are stored as UTC-midnight epoch ms, filter against today's UTC midnight from `Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())` — comparing to `Date.now()` (wall-clock) silently drops today's rows, and the expired filter is `< todayUtcMidnight`.

**Wire-honest raw-SQL row decoding (`references/database-gotchas/raw-sql-wire-honest-rows.md`)**

- `db.exec` returns `rows?: Record<string, unknown>[]`, and force-casting that onto a hand-written interface lets the interface silently drift from the real pg wire shape (e.g. an `int4` SERIAL `id` typed `string` but returned as `number`; an `int8` `created_at` typed `number` but returned as `string`), with no compiler complaint because `unknown` accepts anything. Wrap `db.exec` in `queryRows`/`queryRow` helpers (`app/data/rows.ts`) that zod-parse every returned row and throw naming the statement + row index on mismatch; pass either the `sql` tag or `rawSql(text, values)` for dynamically built SQL. Keep the two row universes distinct: **wire rows** (raw `db.exec`, no `afterRead`/`parseIntFields` hooks, pg-native types) vs **domain rows** (typed `db.findMany`/`TableRow`, hooks applied, timestamps already `number`).
- Write wire schemas that validate the pg shape: `int4` (ids, `*_id`, `start_min`) → `z.number()`; `int8` (timestamps, `date`) → `int8` (`z.coerce.number()`, `app/data/rows.ts`) so raw and typed-API reads agree on a number; aggregates over int8 (`count`/`min`/`max`/`sum`/`avg`) and `::numeric` results → `int8Aggregate` (`z.coerce.number()`); JSONB → `z.record(...)`/`z.array(...)`/`z.unknown()`; opaque bytea → `z.custom<Buffer>()`. **Check the baseline migration first** — not every `id` is int4 (`webhook_requests.id` is `UUID` → `z.string()`). Replace hand-written interfaces with `type Row = z.output<typeof rowSchema>` as the single source of truth.

### When to Use

- You are writing or debugging any Postgres access in a Remix 3 app: DDL/migrations, constraint-violation handling in controllers, or raw `db.exec` queries.
- A migration timeout or catalog duplicate-key appears during test setup or concurrent boot; startup fails with a migration checksum-drift or orphaned-journal error; a delete/update throws a constraint violation and the action returns an unhelpful JSON 500; or raw-SQL rows have the wrong shapes (string `int8`, number `int4`, dropped "today" rows).
- Before adding a DDL migration, editing or deleting an applied migration, adding a controller catch around a write, or writing an aggregate/join via `db.exec`.

### Related Skills

- `remix3-data § Postgres` — the PostgreSQL quirks umbrella: idempotent FK alterations, `LIMIT` without `ORDER BY`, locale-dependent error matching, and the schema/validation side of `int8`-as-string
- `remix3-data § Data-Table` — the remix/data-table grid umbrella: typed `findMany`/`findOne`/`create` pitfalls, `inList()` filters, row adapters, and raw-SQL sort/filter grids
- § Validation Errors — controller validation-failure re-renders (`parseSafe`, preserved values, per-field errors) that complement the DB-error `formError` re-render path

---

## Postgres

_(formerly `postgres-gotchas` — references live under `references/postgres-gotchas/`)_

**Consolidated from:** the five former `postgres-gotchas` notes (FK alteration, `LIMIT`, locale, `int8`, index safety)

Covers five PostgreSQL pitfalls:
1. Idempotent FK constraint alteration (`ON DELETE` behavior changes)
2. `LIMIT 1` without `ORDER BY` is non-deterministic
3. Locale-dependent error message matching breaking JS libraries
4. node-postgres returning `BIGINT`/`int8` columns as strings
5. Judging index liveness/redundancy before dropping one

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Any of: FK `ON DELETE` changes, `LIMIT` without `ORDER BY`, locale-dependent errors, `int8`/`BIGINT` strings, index-drop safety | `references/postgres-gotchas/gotchas.md` |

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
- `remix3-data § Database` — DDL/catalog-race diagnosis and migration checksum-drift recovery (`references/database-gotchas/migrations.md`)
- `postgres-patterns` — general PostgreSQL schema, query, and indexing patterns
- `database-reviewer` — the review workflow that surfaces `pg_stat_user_indexes`; apply this reference's caveat before acting on a 0-scan row

---

## Forms & Mutations

_(formerly `remix-forms` — references live under `references/remix-forms/`)_

**Consolidated from:** `remix-data-schema-optional-top-level`, `remix-data-confirm-delete-event-delegation`, `remix-password-form-patterns`, `remix-session-flash-soft-fork`

This skill is the **index** for form/data deltas. For validation and error re-render, use § Validation Errors; for the framework API, the vendor `remix` skill references.

The vendor guide `node_modules/remix/guides/09-forms-and-mutations.md` (authored as of rc.4) is canonical for the basics this skill does not restate: `parseSafe` re-render with preserved `values`/`issues` and status 400, `303`-after-save redirects, the frame `reloadStart`/`reloadComplete` "Saving…" pending button (§"Add pending feedback"), and `_method` override with `formMethod: "PATCH"` (§"Use other HTTP methods when the route calls for them"). The rules below stay deltas because the guide does not cover them: top-level `s.optional()`, capture-phase delete confirmation, password-form handling, and `session.flash()` soft-fork routing.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Adding a `confirm()` dialog to server-rendered delete forms; intercepting a form submit before frame navigation; replacing native `confirm()` with a styled native modal `<dialog>` (focus containment, inert page, focus restoration), reusing it from context-menu or bulk triggers, or freezing a bulk action's confirmed id set against a selection that changes behind the dialog (`formdata` rewrite) | `references/remix-forms/delete-confirmation.md` |
| Password confirmation (cross-field), keeping passwords out of `defaultValue`, visibility toggle (`data-toggle-pw`), the `app/ui` vs `app/assets` `clientEntry` trap | `references/remix-forms/password-forms.md` |
| One-shot UI state after a POST (routing card) that must self-clear on refresh (`session.flash()` vs `session.set()`), or a session value you mutated in place is missing on the next request (storing a map/array/set) | `references/remix-forms/session-persistence.md` |
| An agent tool decision or `ask_user` question must be resolvable without JS; a native `<form>` must post to an SSE-backed route — resolving the pending gate, per-button `formaction`, repeated `answer` fields for multi-select, the `skipCsrf()` token fallback, draining the stream to `303` + flash; or a message composer must submit without JS — action/method + `_csrf`, bounded drain (`AGENT_TIMEOUT_MS + 5s`), single-flight native guard | `references/remix-forms/native-form-on-sse-decision.md` |

### Core Rules

- `remix/data-schema` `.optional()`/`.nullable()` are **top-level functions**, not methods: use `s.optional(s.string())`, not `s.string().optional()` (`Property 'optional' does not exist on type 'Schema<...>'`). Full API: `node_modules/remix/src/data-schema/README.md`.
- Delete confirmation must intercept at the **capture-phase click** level (`{ capture: true }` + `preventDefault()` + `stopPropagation()`); a `submit`-phase listener can be preempted by frame navigation.
- A **bulk** confirmation must freeze the id set and rewrite the payload in the form's `formdata` listener — the dialog is not inert, Chromium builds the payload after `requestSubmit()` returns, and it can fire `formdata` more than once for one submission.
- Render exactly **one** `<ConfirmDelete />` per grid section — one per row causes N stacked `confirm()` dialogs.
- When a dialog re-submits, call `form.requestSubmit(submitter)`, never `form.submit()`: `submit()` bypasses the `submit` event and the frame runtime, producing a full-page navigation.
- Never put `defaultValue` on password fields; exclude them from `readFormFieldValues` key arrays.
- Use `session.flash()` (not `session.set()`) for UI state that should render once and disappear on refresh.
- Session values persist only through `session.set()`/`unset()`: both stores' `save()` write only when `session.dirty`, which in-place mutation never sets. Read-modify-write a **fresh** container and call `set()`; never mutate the object returned by `get()`.
- An SSE-backed decision endpoint can also accept a native form: render the resolved gate as `<form method="post">` (one form, per-button `formaction`), let a token-bearing form fall through `skipCsrf()` to the regular `csrf()` check, drain the SSE response server-side, then `303` + `session.flash()`. Enhance by intercepting `submit` and reusing the stream — never a click handler on a bare button. The message composers use the same shape: `<form method="POST" action>` + `_csrf`; a native POST drains through `completeNativeForm` (bounded at `AGENT_TIMEOUT_MS + 5s`), and a per-surface `createNativeTurnGuard` stops a double submit from starting two turns.
- An `ask_user` question gate takes the same form: a hidden `selectionMode` plus named `answer` control(s). A multi-select posts the name repeatedly, so normalize `formData.getAll('answer')` to a JSON array in the controller for **both** transports — the engine parses a leading `[`. A single multi-select field may already hold that JSON array (SSE clients), so wrap only when the value does not start with `[`; a blanket wrap double-encodes. The customer `/chat` and admin `/admin/support-agent` gates share the `completeNativeForm`/`normalizeAnswerFields` helpers in `app/utils/agent-chat.ts`.

### Related Skills

- `remix3-server § Controllers` — `form()` routes need `createController`
- `remix3-ui § Frames` — clientEntry lifecycle, `ref()` usage, drag-and-drop (`references/remix3-frame-cliententry/cliententry-lifecycle.md`, `references/remix3-frame-cliententry/cliententry-dom-and-styling.md`), and input value across frame reloads (`references/remix3-frame-cliententry/frame-layout-and-testing.md`)
- § Validation Errors — `parseSafe` validation re-render, `coerce.number()` empty-select pitfall, `<select selected>` type coercion
- `remix3-server § Security` — the `skipCsrf()` agent-path token fallback (`references/security-gotchas/security-middleware.md`)

---

## Validation Errors

_(formerly `form-error-handling-remix3` — references live under `references/form-error-handling-remix3/`)_

Handle form validation errors with the **direct re-render** pattern (preferred): use `parseSafe` from `remix/data-schema` to make validation failures a return value instead of an exception, then re-render the page with `formValues` and `fieldErrors`.

The URL-param roundtrip pattern (`fv_`/`fe_` encoding) is **deprecated** — `form-params.ts` has been removed and all forms use direct re-render. Frame-based forms that once needed URL params are handled by the `ShellOrFragment` patch in `remix3-ui § Frames`.

The vendor guide `node_modules/remix/guides/09-forms-and-mutations.md` (authored as of rc.4) canonically shows the `parseSafe` + preserved-`values`/`issues` + status-400 pattern (§"Return validation failures with the form", §"Parse and save the submitted form") and the `readText()` display-values helper. This skill keeps the app-specific deltas the guide cannot know: admin-grid `renderGridFormError` returning **200 not 400**, `<select>` `selected` over `defaultValue`, and the `coerce.number()` empty-select trap.

### When To Use This Skill

- Adding validation to a POST/PUT/DELETE form action
- Rendering per-field error messages next to form inputs
- Preserving submitted form values after a validation failure
- Preserving admin grid state (sort/filter/pagination) across a failed POST
- Re-rendering an admin edit form after a partial/API update with optional fields
- Testing form validation controller behavior

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `parseSafe` + schema, value preservation, select fields, `coerce.number()`/empty-select and Postgres `number`-vs-string traps, the empty-string `""` select fallback, multi-source field precedence (preset + custom), code-based `errorMap` localization, `role="alert"`/`aria-invalid`/focus-first-invalid wiring, cross-field and wizard checks, validation tests | `references/form-error-handling-remix3/validation-and-schema.md` |
| `s.defaulted()` returning its default **without running the wrapped schema** — defaulted→required fields silently bypass validation; missing-field fail-fast and issue-message mapping (`promptSchema`, `promptIssueMessage`) | `references/form-error-handling-remix3/defaulted-skips-validation.md` |
| Admin CRUD grids: a shared `loadPageData`, `grid-state.ts` hidden inputs, `renderGridFormError` returning **200 not 400**, error banners, partial updates with optional fields, open edit/create panel state | `references/form-error-handling-remix3/admin-grid-state.md` |
| Adding a new URL-query-param filter that drives a SQL `WHERE` (the 8+ touchpoint checklist), or separating status tabs from text search | `references/form-error-handling-remix3/url-param-filter-checklist.md` |

### Core Rules

- Use `s.parseSafe`, never `s.parse`, for form validation. `parse` throws and loses error details; `parseSafe` returns `{ success, value }` or `{ success, issues }`.
- Localize built-in check messages through `parseSafe(..., { errorMap })` keyed on `context.code`; Standard Schema issues carry no `code` (only `message`/`path`), and comparing the vendor's English `message` breaks on rewording.
- **`s.defaulted(chained, default)` returns its default without running the wrapped schema** — never wrap a required/validated field in it. A defaulted→required field parses the default as a *success*, silently bypassing every `.refine` in the chain. Let missing fields fail the base type check and map the generic issue at the response boundary (`promptIssueMessage()` in `app/actions/agent-events/controller.tsx`). Details + pinned vendor line refs (`src/lib/schema.ts:667-685`, preview release `v0.20261113.174821-main-9ceaeb82`): `references/form-error-handling-remix3/defaulted-skips-validation.md`.
- Two controls for one setting (preset + custom): parse both as defaulted strings, select the source in a `.transform()`, then `.refine()` the selected value and `.transform()` back to the original parsed shape. Validating each field independently cannot express "custom wins when filled"; see § Multi-Source Fields in `references/form-error-handling-remix3/validation-and-schema.md` (`app/utils/get-page-size.ts`).
- Extract raw string values from `FormData` **before** validation and pass them back as `formValues` so the user never re-types input.
- `formValues` (from a failed submit) take priority over row data (from the DB); fall back to the row only when absent. For optional update fields, make absence real with `formData.has(key)`; otherwise `readFormFieldValues()` fills `''` and the row is overwritten.
- Never overload one grid param: status tabs get `status`, free-text search gets `filter` (trimmed, LIKE-escaped, ORed with a numeric id). Grid navigation links must re-append an open `editing`/`creating` panel.
- `<select>` does not honor `defaultValue` in Remix 3 — use `selected` on each `<option>`.
- A cleared select submits `""`, and `"" != null` is true: normalize the preserved id to `""` and select a disabled placeholder option when empty, or the browser shows the first option while the field error says required.
- Server-rendered errors need `role="alert"`, `aria-invalid`/`aria-describedby` on the control, and a focus-first-invalid `clientEntry`; the markup alone is silent to screen readers.
- Full-page/non-admin forms re-render with `{ status: 400 }`. Admin **grid** forms must render through `renderGridFormError`, which returns **200** so the frame shows inline errors (a non-OK response becomes an error card).
- Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

### References in This Codebase

- `app/utils/schema-utils.ts` — shared `issuesToFieldErrors()` and `readFormFieldValues()`
- `app/actions/agent-events/controller.tsx` — `promptSchema` (required field, no `s.defaulted`) + `promptIssueMessage()` response-boundary mapping, tested in `prompt-schema.test.ts`
- `app/utils/offering-schema.ts` — declarative `f.object()` + `coerce.number()` + `.refine()`
- `app/utils/get-page-size.ts` — `pageSizeFormSchema` hybrid preset + free-form precedence (`pageSizeCustom` wins when non-empty)
- `app/ui/page-size-control.tsx` — shared `PageSizeSelect`/`PageSizeCustomInput` used by every grid and Settings; `page-size-select-sync`/`page-size-custom-keys` client entries add coarse→fine sync and preset jumps
- `app/utils/grid-state.ts` — `gridStateFromFormData`, `gridStateOverrides`, `gridStateToParams`
- `app/actions/client/controller.tsx` + `controller.test.ts` — direct-re-render reference and tests
- `app/ui/admin-grid-error.tsx` — `renderGridFormError` (status 200)

### Related

- `remix3-ui § Frames` — the `ShellOrFragment` patch that makes a 400 full-page re-render correct inside a `<Frame>`
- `remix3-server § Route Wiring` (`references/remix3-route-wiring/route-relocation.md`) — route relocation checklist and form-validation upgrade cross-reference
