---
name: remix3-data-table-dynamic-sort-order-by
description: 'db.findMany({ orderBy }) rejects a dynamic sort column typed as string with TS2322 OrderByTuple — narrow the column to a SORTABLE_FIELDS union and cast it in the orderBy tuple'
origin: auto-extracted
---

# Remix Data-Table: Dynamic Sort Column in `orderBy`

**Extracted:** 2026-08-26
**Context:** Building a sortable admin grid where the sort column comes from the URL (`parseSort`) and is passed to `db.findMany(lists, { orderBy })`.

## Problem

`db.findMany(table, { orderBy })` types the sort column as a typed column key (`SingleTableColumn`), so passing a bare `string` column fails typecheck even though the value is always one of the valid columns:

```
error TS2322: Type '[string, "asc" | "desc"]' is not assignable to type 'OrderByTuple<Table<"lists", {...}, readonly "id"[]>>'.
  Type at position 0 in source is not compatible with type at position 0 in target.
    Type 'string' is not assignable to type 'SingleTableColumn<Table<"lists", ...>>'.
```

This happens because `parseSort`/sort helpers return `column: string`, and the value is a runtime-validated string, not a literal. The `TS2322` is a type-only failure — the query would run fine at runtime — so it is easy to misread as a bug.

## Solution

Define the allowed columns as a `const` tuple, derive a union type from it, then cast the dynamic column to that union inside the `orderBy` tuple. The cast is safe because `parseSort` (and the equivalent form helper) validates the column against the same `SORTABLE_FIELDS` whitelist before it is used.

```typescript
const SORTABLE_FIELDS = ['id', 'title', 'description', 'created_at', 'updated_at'] as const
type ListSortColumn = (typeof SORTABLE_FIELDS)[number]

// opts.column comes from parseSort(url, { allowedColumns: SORTABLE_FIELDS, ... }) → string
let rows = await db.findMany(lists, {
  limit,
  offset: opts.offset,
  orderBy: [
    [opts.column as ListSortColumn, opts.direction],
    ['id', 'desc'],
  ] as const,
})
```

Key points:

- `as const` on `SORTABLE_FIELDS` lets `(typeof SORTABLE_FIELDS)[number]` produce the literal union.
- Cast `opts.column as ListSortColumn` (not `as any`) so type-checks narrow cleanly while the runtime contract (whitelist-validated column) is preserved.
- Add a stable `['id','desc']` tiebreaker so pagination is deterministic across non-unique sort columns.
- The same whitelist discipline applies to a raw-SQL `ORDER BY` — interpolate only the validated column, never user input.

## When to Use

- `db.findMany` / `db.findOne` `orderBy` receives a column that is a `string` (from `parseSort`, a URL param, or a form field) rather than a literal.
- `tsc` reports `TS2322 ... OrderByTuple<Table<...>>` with `Type 'string' is not assignable to type 'SingleTableColumn<...>'`.
- Building a sortable admin grid where `sort`/`order` are carried as grid state and must round-trip.

## Related

- `remix3-data-table-array-in-clause` — vendor `inList()` operator and the `db.exec`/`= ANY($1)` fallback
- `parseSafe` / `grid-state.ts` grid-state round-trip used by the admin page handlers
