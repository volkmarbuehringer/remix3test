---
name: remix3-data-table-array-in-clause
description: 'Use db.exec with explicit IN ($1,$2) when querying by multiple IDs — db.findMany({where:{id:ids}}) silently breaks'
origin: auto-extracted
---

# Remix Data-Table: Array `IN` Clauses Need `db.exec`, Not `db.findMany`

**Extracted:** 2026-07-13
**Context:** Querying rows by multiple IDs using `@remix-run/data-table`'s `db.findMany`

## Problem

Passing an array of IDs to `db.findMany({ where: { id: [1, 2, 3] } })` produces a `DataTableAdapterError` with `ungültige Eingabesyntax für Typ integer` (invalid input syntax for type integer). The adapter serializes the array as a PostgreSQL array literal string `'{"1","2","3"}'` instead of expanding it into an `IN` clause:

```
error: ungültige Eingabesyntax für Typ integer: »{"1","2","3"}«
```

## Solution

Use `db.exec` with PostgreSQL's `= ANY($1)` syntax. The `pg` driver binds JS arrays correctly — no dynamic placeholders needed:

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

- Querying `db.findMany` or `db.findOne` with `where: { column: arrayValue }`
- Error message contains `ungültige Eingabesyntax für Typ integer` with a JSON array string like `'{"1","2","3"}'`
- Any query that needs results in a specific ID order
