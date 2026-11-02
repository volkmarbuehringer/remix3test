# Data-Table Query Patterns (IN lists, sorting, counts)

**Source:** consolidated from `remix3-data-table-array-in-clause`, `remix3-data-table-dynamic-sort-order-by`, `remix3-data-table-count-with-typed-where`

**Extracted:** 2026-07-13 … 2026-08-26
**Context:** Typed `db.findMany`/`db.count`/`paginate` patterns used by admin grids. For raw SQL see `raw-sql-sort-filter.md`; for row adapters see `row-adapter.md`.

## Multi-ID filters: `inList()`

Passing an array to a `WhereObject` fails:

```ts
await db.findMany(lists, { where: { id: [1, 2, 3] } })
// DataTableDatabaseError: invalid input syntax for type integer
```

`normalizeWhereInput` expands each key with `eq(column, value)`, so `{ id: [1, 2, 3] }` becomes `eq('id', [1, 2, 3])` — one `=` comparison whose value is an array.

Use the vendor operator from `remix/data-table/operators`, passed as the whole `where` value:

```ts
import { inList } from 'remix/data-table/operators'

let result = await db.findMany(lists, {
  where: inList('id', ids),
})
```

`inList(column, values)` builds an `IN` predicate (`valueType: 'value'`), so the adapter expands a proper clause. The subpath export and its types are the authority — the installed `src/data-table/README.md` has no "Operators" section.

**Input order is not preserved** — rows come back in table order. If exact input order matters, use `db.exec` with `array_position($1::integer[], id)` (see `raw-sql-sort-filter.md`); no app route currently needs this.

## Dynamic sort column in `orderBy`

`db.findMany(table, { orderBy })` types the column as `SingleTableColumn`, so a `string` from `parseSort` fails typecheck:

```
TS2322: Type '[string, "asc" | "desc"]' is not assignable to type 'OrderByTuple<...>'
```

The query would run fine at runtime; this is type-only.

Narrow the column to a whitelist-derived union and cast, not `as any`:

```ts
const SORTABLE_FIELDS = ['id', 'title', 'description', 'created_at', 'updated_at'] as const
type ListSortColumn = (typeof SORTABLE_FIELDS)[number]

// opts.column came from parseSort(url, { allowedColumns: SORTABLE_FIELDS, ... })
let rows = await db.findMany(lists, {
  limit,
  offset: opts.offset,
  orderBy: [
    [opts.column as ListSortColumn, opts.direction],
    ['id', 'desc'],
  ] as const,
})
```

- `as const` on the tuple produces the literal union.
- Cast to the union (not `any`) — the runtime whitelist already validated the column.
- Add the stable `['id', 'desc']` tiebreaker so pagination is deterministic.
- Raw SQL follows the same discipline: interpolate only a validated column.

## Counting filtered rows with a typed `where`

`db.count` is narrower than `findMany`/`paginate`:

```ts
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>
export type CountOptions<table extends AnyTable> = { where?: SingleTableWhere<table> }
async count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>
```

A shared predicate typed as `WhereInput` therefore fails:

```
TS2345: Argument of type '{ where: WhereInput; } | undefined' is not assignable to parameter of type 'CountOptions<...>'
```

Type the predicate and its conditions against the table:

```ts
import { and, or, ilike, type SingleTableWhere } from 'remix/data-table'

function buildClientsFilterPredicate(...): SingleTableWhere<typeof clients> | undefined {
  let conditions: SingleTableWhere<typeof clients>[] = []
  // ...
  return and(...conditions)
}

let where = buildClientsFilterPredicate(filter, status)
let total = await db.count(clients, where ? { where } : undefined)
```

The narrower type is still assignable to `paginate()`/`findMany`'s `WhereInput`.

`paginate()` returns only `{ items, hasMore }`; issue a second count with the same `where`:

```ts
let { items: rows, hasMore } = await paginate(db, clients, { pageSize, page, orderBy, where })
let total = await db.count(clients, where ? { where } : undefined)
return { rows, hasMore, total }
```

When `renderGridFormError` loads rows, let its `loadRows` result carry the optional `total`; loaders that do not count leave it `undefined`. Reference: `app/actions/client/controller.tsx` (`buildClientsFilterPredicate`, `loadGridData`), `app/ui/admin-grid-error.tsx`, `app/actions/client/page.tsx`/`grid-page.tsx`.

## When to Use

- A multi-ID filter (always `where: inList('id', ids)`); the error contains `ungültige Eingabesyntax für Typ integer` and a JSON-array string.
- `db.findMany`/`db.findOne` `orderBy` receives a `string` rather than a literal (`TS2322 ... OrderByTuple`).
- A shared filter predicate works for `findMany`/`paginate` but `db.count` rejects it with `TS2345`.
- A paginated grid needs a total row count.
