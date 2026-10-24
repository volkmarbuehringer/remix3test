# Array `IN` Clauses

**Extracted:** 2026-07-13
**Revalidated:** 2026-10-24 against the installed `remix` 3.1.0 (`@remix-run/data-table`).

## Problem

Passing an array of IDs to `db.findMany({ where: { id: [1, 2, 3] } })` produces a `DataTableDatabaseError` (native PG error on `.cause`) with `ungültige Eingabesyntax für Typ integer` (invalid input syntax for type integer). `normalizeWhereInput` expands a `WhereObject` by calling `eq(column, value)` for each key, so `{ id: [1, 2, 3] }` becomes `eq('id', [1, 2, 3])` — a single `=` comparison whose value happens to be an array.

## Solution: `inList()`

Use the vendor operator from `remix/data-table/operators`, passed as the whole `where` value (not nested under the column):

```typescript
import { inList } from 'remix/data-table/operators'
import { lists } from './schema.ts'

let result = await db.findMany(lists, {
  where: inList('id', ids),
})
```

`inList(column, values)` builds an `IN` predicate (`valueType: 'value'`), so the adapter expands the values into a proper `IN` clause instead of a single array literal. The subpath export and its types are the authority — the installed `src/data-table/README.md` has no "Operators" section.

## Delta: `inList()` does not preserve input order

Rows come back in table order. If exact input order matters, use `db.exec` with `array_position` (see `raw-sql-sort-filter.md` for the `sql`/`rawSql` composition; pass the ids as one `$1::integer[]` parameter and `ORDER BY array_position($1::integer[], id)`). No app route currently needs this.

## When to Use

- A multi-ID filter — always `where: inList('id', ids)`.
- The error message contains `ungültige Eingabesyntax für Typ integer` with a JSON-array string like `'{"1","2","3"}'` — an array was passed as a single value.
