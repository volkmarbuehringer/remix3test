---
name: remix3-data-table-raw-sql-sort-filter
description: "Use when a remix/data-table raw-SQL grid (`sql`/`rawSql`/`db.exec`, not `db.findMany`) needs sortable/filterable columns — whitelist identifiers, build ORDER BY/WHERE, add an id tiebreaker."
metadata:
  origin: auto-extracted
---

# Remix Data-Table: Safe Raw-SQL Sort + Filter

**Extracted:** 2026-09-05
**Revalidated:** 2026-09-12 against the pinned `remix` 3.0.0-rc.2 (build `c2afabc`) — direction compilation is now vendor-covered by `compileOrderByDirection()` (`remix/data-table/sql-helpers`, added upstream in #11838).
**Context:** Adding URL-driven sort and search-filter columns to the `/admin/uploads` grid, which queries the DB through raw `sql`/`rawSql` statements (`app/data/uploads.ts`) rather than the typed `db.findMany` API.

## Problem
A raw-SQL grid (`db.exec` + `queryRows`/`queryRow` + the `sql` tag) has no typed `orderBy`/`where` object, so sort and filter columns come straight from the URL (`?sort=`, `?filter=`). Two hazards:

1. Column identifiers cannot be parameterized. `sql\`ORDER BY ${col}\`` interpolates the column as a literal value, not an identifier — and interpolating it unvalidated opens SQL injection.
2. Passing optional `sortColumn`/`filter` through layered functions hits `exactOptionalPropertyTypes: true` — `string | undefined` is not assignable to `sortColumn?: string`.

## Solution
### 1. Whitelist columns and build ORDER BY as a `rawSql` fragment
`rawSql` returns a `SqlStatement`; interpolating it into the `sql` tag appends its text and values verbatim. Validate the column before emitting it, fall back to the store default on anything invalid, and add an `id` tiebreaker in the same direction so pagination is stable across ties.

Compile the direction with the vendor `compileOrderByDirection()` from `remix/data-table/sql-helpers` — do not hand-roll `x === 'asc' ? 'ASC' : 'DESC'`. It normalizes `asc`/`desc` case-insensitively and throws a `TypeError` on anything else, so an invalid runtime value fails loudly instead of silently coercing to the fallback branch. When the direction parameter is optional, pass the previous default explicitly (`compileOrderByDirection(direction ?? 'desc')`) so an omitted value keeps its old behavior while a bogus value still throws.

```ts
import { compileOrderByDirection } from 'remix/data-table/sql-helpers'

export const UPLOAD_SORT_FIELDS = ['id', 'filename', 'mime_type', 'size', 'created_at'] as const

function orderByStatement(sortColumn: string, sortDirection: 'asc' | 'desc'): SqlStatement {
  if (!(UPLOAD_SORT_FIELDS as readonly string[]).includes(sortColumn)) {
    return rawSql('ORDER BY created_at DESC, id DESC') // invalid column → safe default
  }
  let dir = compileOrderByDirection(sortDirection)
  return rawSql(`ORDER BY ${sortColumn} ${dir}, id ${dir}`)
}
```

### 2. Build WHERE (ownership + filter) the same way — all values parameterized
A numeric filter matches the id exactly; any other term does a case-insensitive substring match on the text columns. Every value goes through a `?` placeholder in `rawSql`.

```ts
function whereStatement(userId?: number, filter?: string): SqlStatement {
  let conditions: string[] = []
  let values: unknown[] = []
  if (userId !== undefined) { conditions.push('uploaded_by = ?'); values.push(userId) }
  let trimmed = filter?.trim()
  if (trimmed) {
    if (/^\d+$/.test(trimmed)) { conditions.push('id = ?'); values.push(Number(trimmed)) }
    else { conditions.push('(filename ILIKE ? OR mime_type ILIKE ?)'); values.push(`%${trimmed}%`, `%${trimmed}%`) }
  }
  return conditions.length ? rawSql(`WHERE ${conditions.join(' AND ')}`, values) : rawSql('')
}
```

### 3. Compose them into one statement; the `sql` tag aligns placeholders for you
The `sql` tag walks the template, appending each nested `SqlStatement`'s text and its `values`, so `?` placeholders and the values array stay aligned across the whole statement. Drop the manual `WHERE uploaded_by = $1` / `ORDER BY ...` branches.

```ts
let where = whereStatement(userId, filter)
let orderBy = orderByStatement(sortColumn, sortDirection)
let rows = await queryRows(
  db,
  sql`SELECT id, filename, mime_type, size, created_at FROM uploads ${where} ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
  uploadRowSchema,
)
```

### 4. Widen pass-through optionals for `exactOptionalPropertyTypes`
`exactOptionalPropertyTypes: true` rejects `string | undefined` passed to `sortColumn?: string`. Widen the target optional type to accept `| undefined` (keep the `?? default` in the destructure).

```ts
opts: { sortColumn?: string | undefined; sortDirection?: 'asc' | 'desc' | undefined; filter?: string | undefined } = {}
// let { sortColumn = 'created_at', sortDirection = 'desc', filter } = opts
```

### 5. Let the count reflect the filter
`countUploads` must use the same `where` fragment so the pagination ("Seite X von Y") matches the filtered set, not the table total.

```ts
let total = await countUploads(db, userId, filter) // uses whereStatement(userId, filter)
```

## When to Use
- A raw-SQL grid (`sql`/`rawSql`/`db.exec`, not `db.findMany`) needs URL-driven sort and/or search-filter columns.
- You want safe dynamic `ORDER BY`/`WHERE` with whitelisted column identifiers and parameterized values.
- You're about to write an `ORDER BY … ${direction}` ternary — use the vendor `compileOrderByDirection()` from `remix/data-table/sql-helpers` instead of a hand-rolled `'ASC' : 'DESC'`.
- You're passing optional sort/filter params through layered functions and `tsc` complains under `exactOptionalPropertyTypes`.

## Related
- `remix3-data-table-dynamic-sort-order-by` — the typed `db.findMany({ orderBy })` TS2322 counterpart (same whitelist discipline)
- `remix3-data-table-array-in-clause` — `inList` / `= ANY($1)` multi-ID filter
- `remix3-raw-sql-wire-honest-rows` — decoding `db.exec` rows with wire-honest zod schemas
- `exact-optional-property-types-migration` — the general `exactOptionalPropertyTypes` widening pattern
