# Counting Filtered Rows with a Typed `where`

## What This Covers

`db.count(table, { where })` for a grid total, and the TS2345 that appears when a shared filter helper returns the broad `WhereInput` instead of the table-specific `SingleTableWhere<table>`. Vendor build `7f900151`.

## The Mismatch

Vendor types (`@remix-run/data-table/src/lib/database.ts:227`, `:301`, `:741`):

```ts
export type SingleTableWhere<table extends AnyTable> = WhereInput<SingleTableColumn<table>>
export type CountOptions<table extends AnyTable> = { where?: SingleTableWhere<table> }
async count<table extends AnyTable>(table: table, options?: CountOptions<table>): Promise<number>
```

`db.findMany` and the project `paginate()` helper accept a predicate typed `WhereInput`, but `db.count` does not:

```
TS2345: Argument of type '{ where: WhereInput; } | undefined' is not assignable to parameter of type 'CountOptions<Table<...>>'
  Type 'WhereInput' is not assignable to type 'SingleTableWhere<Table<...>>'
```

## Fix

Type the predicate and its conditions array against the table:

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

## Adding a Total to a Paginated Grid

`paginate()` returns only `{ items, hasMore }`; issue a second count with the same `where`:

```ts
let { items: rows, hasMore } = await paginate(db, clients, { pageSize, page, orderBy, where })
let total = await db.count(clients, where ? { where } : undefined)
return { rows, hasMore, total }
```

When a shared error re-render helper (`renderGridFormError`) loads rows, let its `loadRows` result carry the optional `total` and pass it into the page component; loaders that do not count leave it `undefined`.

Reference implementation: `app/actions/client/controller.tsx` (`buildClientsFilterPredicate`, `loadGridData`), `app/ui/admin-grid-error.tsx`, `app/actions/client/page.tsx`/`grid-page.tsx`.
