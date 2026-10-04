---
name: remix3-data-table
description: 'Use when working with remix/data-table grids — typed `db.findMany`/`db.findOne`/`db.create` typing pitfalls (dynamic sort column, unknown json/bigint columns, row adapters), multi-ID `inList()` filters, and raw-SQL (`sql`/`rawSql`/`db.exec`) sort/filter grids.'
user-invocable: false
origin: consolidated
---

# Remix 3 Data-Table Patterns

**Consolidated from:** `remix3-data-table-array-in-clause`, `remix3-data-table-dynamic-sort-order-by`, `remix3-data-table-raw-sql-sort-filter`, `remix3-data-table-row-adapter`

This skill is the **index** for data-table deltas. For the framework API and canonical query patterns, use `node_modules/remix/src/data-table/README.md` and `node_modules/remix/src/data-schema/README.md`.

The vendor guide `node_modules/remix/guides/08-data-and-validation.md` (authored as of rc.4) is canonical for the typed-API surface this skill does not restate: `table()`/`TableRow`/`primaryKey`, SQL migration files + `loadMigrations`/`db.migrate` + checksums, `databaseContext` middleware (`context.db`), form-data schemas (`f.object`/`f.field`/`f.fields`/`f.file(s)`, `s.defaulted`, `coerce.number()`), relations (`belongsTo`/`hasMany`/`hasOne`/`hasManyThrough` + `with`), `query()` values vs `db.query()` chains, the `sql` tag, lifecycle hooks (`validate`/`fail`, `beforeWrite`/`afterWrite`/`beforeDelete`/`afterDelete`/`afterRead`), `db.transaction`, and the SQLite/PostgreSQL/MySQL adapters — all under the guide's "Advanced data and validation" section. The rules below stay deltas because the guide does not cover them: `inList()` multi-ID filters, dynamic sort columns, raw-SQL sort/filter grids, and row adapters.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Querying by multiple IDs — `inList()` vs `= ANY($1)` order-preserving fallback | `references/array-in-clause.md` |
| `db.findMany({ orderBy })` rejecting a dynamic sort column (TS2322 OrderByTuple) | `references/dynamic-sort-order-by.md` |
| Raw-SQL grid (`sql`/`rawSql`/`db.exec`) needing safe sort + filter columns | `references/raw-sql-sort-filter.md` |
| `TableRow<typeof table>` won't assign to a UI row type (unknown json/bigint columns) | `references/row-adapter.md` |

## Core Rules

- **Multi-ID filter**: `where: inList('id', ids)` (vendor operator). Fall back to `db.exec` + `= ANY($1)` + `array_position` only when the input-ID order must be preserved.
- **Dynamic sort column**: narrow to a `SORTABLE_FIELDS` union and cast (`as ListSortColumn`, not `as any`); add a stable `['id','desc']` tiebreaker.
- **Raw-SQL sort/filter**: whitelist column identifiers, build `ORDER BY`/`WHERE` as `rawSql` fragments, parameterize every value, and compile the direction with the vendor `compileOrderByDirection()` (`remix/data-table/sql-helpers`).
- **Typed-API rows**: own one canonical row interface plus one adapter that narrows `unknown` json/bigint columns at a single boundary — no `as unknown as` casts at call sites.
- **Decode `db.exec` rows** with wire-honest zod schemas (int4→number, int8→string) — see `database-gotchas` (`references/raw-sql-wire-honest-rows.md`).
- **`exactOptionalPropertyTypes`**: widen pass-through optionals to `| undefined` instead of fighting the strict flag.

## Related Skills

- `database-gotchas` — decoding `db.exec` rows with wire-honest zod schemas (`references/raw-sql-wire-honest-rows.md`)
- `database-gotchas` — `DataTableDatabaseError` cause unwrapping and PG error codes (`references/database-errors.md`)
- `typescript-gotchas` (`references/exact-optional-property-types.md`) — the general `exactOptionalPropertyTypes` widening pattern