---
name: remix3-data-table-array-in-clause
description: 'Query by multiple IDs with db.findMany({ where: inList("id", ids) }) — the vendor array operator — falling back to db.exec = ANY($1) only for order-preserving results'
origin: auto-extracted
---

# Remix Data-Table: Array `IN` Clauses

**Extracted:** 2026-07-13
**Context:** Querying rows by multiple IDs using `@remix-run/data-table`'s `db.findMany`

## Problem

Passing an array of IDs to `db.findMany({ where: { id: [1, 2, 3] } })` produces a `DataTableAdapterError` with `ungültige Eingabesyntax für Typ integer` (invalid input syntax for type integer). The adapter serializes the array as a PostgreSQL array literal string `'{"1","2","3"}'` instead of expanding it into an `IN` clause:

```
error: ungültige Eingabesyntax für Typ integer: »{"1","2","3"}«
```

## Solution (primary): `inList()` operator

The vendor data-table package exports the canonical array-membership operator `inList()` (`~/remix/packages/data-table/src/index.ts`, documented in the `data-and-validation` reference). `WhereInput` accepts a `Predicate` directly, so pass `inList(...)` as the whole `where` value — not as a nested `{ id: ... }` object:

```typescript
import { inList } from 'remix/data-table/operators'
import { lists } from './schema.ts'

let result = await db.findMany(lists, {
  where: inList('id', ids),
})
```

`inList(column, values)` builds an `IN` predicate (`valueType: 'value'`), so the adapter expands the values into a proper `IN` clause instead of a single array literal.

## Fallback (only when result order matters): `db.exec` + `= ANY($1)`

`inList()` does not preserve the input ID order — rows come back in table order. If you need results in the exact order of the `ids` array, fall back to `db.exec` with `array_position`:

```typescript
import { lists } from './schema.ts'

export async function getListsByIds(
  db: Database,
  ids: number[],
  userId?: number,
): Promise<ListRow[]> {
  if (ids.length === 0) return []

  let ownerClause = userId != null ? 'AND user_id = $2' : ''
  let params: unknown[] = userId != null ? [ids, userId] : [ids]

  let result = await db.exec(
    `SELECT * FROM lists WHERE id = ANY($1::integer[]) ${ownerClause}
     ORDER BY array_position($1::integer[], id)`,
    params,
  )
  return (result.rows ?? []).map(parseRow)
}
```

Key points:

- `= ANY($1::integer[])` replaces dynamic `IN ($1, $2, ..., $N)` — one parameter for the whole array
- `array_position($1::integer[], id)` preserves input ID order by referencing the same parameter
- The `::integer[]` cast ensures the array is treated as integers, not text
- Deduplicate IDs with `[...new Set(ids)]` before passing to avoid ambiguous `array_position` ordering

## When to Use

- Querying `db.findMany` or `db.findOne` with a multi-ID filter — use `where: inList('id', ids)`
- Error message contains `ungültige Eingabesyntax für Typ integer` with a JSON array string like `'{"1","2","3"}'`
- Results must be in the exact input-ID order — use the `db.exec` `array_position` variant

## Related

- `remix-database-errors` — unwrapping `DataTableAdapterError` causes and PostgreSQL error codes
