---
name: remix3-data-table-array-in-clause
description: "Use when querying by multiple IDs in remix/data-table — prefer `db.findMany({ where: inList('id', ids) })`; fall back to `db.exec = ANY($1)` only to preserve order."
origin: auto-extracted
---

# Remix Data-Table: Array `IN` Clauses

**Extracted:** 2026-07-13
**Revalidated:** 2026-09-11 against `remix` 3.0.0-rc.2 (`@remix-run/data-table` d7eb6b18).
**Context:** Querying rows by multiple IDs using `@remix-run/data-table`'s `db.findMany`

## Problem

Passing an array of IDs to `db.findMany({ where: { id: [1, 2, 3] } })` produces a `DataTableAdapterError` with `ungültige Eingabesyntax für Typ integer` (invalid input syntax for type integer). The adapter serializes the array as a PostgreSQL array literal string `'{"1","2","3"}'` instead of expanding it into an `IN` clause:

```
error: ungültige Eingabesyntax für Typ integer: »{"1","2","3"}«
```

**Root cause (still true on rc.2):** `normalizeWhereInput` (`@remix-run/data-table/src/lib/operators.ts:340`) expands a `WhereObject` by calling `eq(column, value)` for each key, so `{ id: [1, 2, 3] }` becomes `eq('id', [1, 2, 3])` — a single `=` comparison whose value happens to be an array. Use the `inList()` predicate instead.

## Solution (primary): `inList()` operator — now vendor-covered

The canonical array-membership operator `inList()` is documented by the vendor `remix` skill itself in `references/data-and-validation.md` ("Operators" section, `remix/data-table/operators`). `WhereInput` accepts a `Predicate` directly, so pass `inList(...)` as the whole `where` value — not as a nested `{ id: ... }` object:

```typescript
import { inList } from 'remix/data-table/operators'
import { lists } from './schema.ts'

let result = await db.findMany(lists, {
  where: inList('id', ids),
})
```

`inList(column, values)` builds an `IN` predicate (`valueType: 'value'`), so the adapter expands the values into a proper `IN` clause instead of a single array literal. **Prefer the vendor-documented `inList()` for all multi-ID filtering.** The delta below is only for the case the vendor operator does not cover.

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

> Note: this `getListsByIds` helper was removed from the app as dead code on
> 2026-09-10 (its route-agent consumer was retired); it is kept here only as the
> reference implementation of the order-preserving pattern.

Key points:

- `= ANY($1::integer[])` replaces dynamic `IN ($1, $2, ..., $N)` — one parameter for the whole array
- `array_position($1::integer[], id)` preserves input ID order by referencing the same parameter
- The `::integer[]` cast ensures the array is treated as integers, not text
- Deduplicate IDs with `[...new Set(ids)]` before passing to avoid ambiguous `array_position` ordering

## When to Use

- Querying `db.findMany` or `db.findOne` with a multi-ID filter — use `where: inList('id', ids)` (also documented in the vendor `remix` skill's `data-and-validation.md`)
- Error message contains `ungültige Eingabesyntax für Typ integer` with a JSON array string like `'{"1","2","3"}'` — this means an array was passed as a single value instead of through `inList()`
- Results must be in the exact input-ID order — use the `db.exec` `array_position` variant (the vendor `inList()` does not preserve input order)

## Related

- `remix-database-errors` — unwrapping `DataTableAdapterError` causes and PostgreSQL error codes
