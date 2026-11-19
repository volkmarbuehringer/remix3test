# SQL Array Interpolation and JSON Column Values

**Extracted:** 2026-11-19
**Revalidated:** against preview release `v0.0.20261119-main-74f06706` / source `74f06706` (data-table #12332/#12335/#12337, shipped in `remix` 3.3.0).

**Semver warning:** `@remix-run/data-table` shipped both changes in **1.1.0** — array expansion and `column.json()` encoding as *minor* changes, same-copy fragment tracking as a *patch*. The changelog explicitly warns that composed statements "may now return different results or raise driver errors", so treat a data-table minor/patch bump as potentially breaking and diff the changelog, not just the version.

## Problem

Two value rules changed at the 3.3.0 pin, and both fail at the database rather than at typecheck:

1. **`sql` expands an interpolated array into a parenthesized list** (`#12332`): `` sql`id in ${ids}` `` becomes `id in (?, ?)`. An empty array throws `TypeError: Cannot interpolate an empty array into SQL`.
2. **`column.json()` serializes every value with `JSON.stringify()`** (`#12337`), including strings. The old rule treated a string as pre-serialized JSON text; carrying that pattern forward double-encodes.

The app hit both during the bump: 81 server failures, all from five `ANY(${array}::type[])` sites and two manual JSON pre-serializations.

## Symptoms

| App code | Database error |
| --- | --- |
| `` sql`... id = ANY(${ids}::int[])` `` with 2+ ids | `cannot cast type record to integer[]` — the array became `(?, ?)` |
| same with exactly 1 id | `malformed array literal: "152"` — the array became `(?)`, one scalar |
| `beforeWrite` does `next.list = JSON.stringify(value)` on a `c.json()` column | `cannot get array length of a scalar` (`jsonb_array_length`) or `cannot extract elements from a scalar` (`jsonb_array_elements`) |
| `db.create(table, { rules: JSON.stringify(rules) })` on a `c.json()` column | `z.record` row schema: `expected record, received string` — the value is a JSON **string**, not an object |

## Solution

### 1. Lists: `IN ${array}`; whole-array parameters: `rawSql('?', [array])`

For a multi-ID filter, let the tag expand the list (and guard the empty case yourself):

```ts
if (ids.length === 0) return []
let rows = await db.exec(sql`select id from uploads where id in ${ids}`)
// => select id from uploads where id in (?, ?), values: [1, 2]
```

To keep a PostgreSQL array as **one** parameter (the `= ANY($1::int[])` shape, including empty arrays), wrap it in a nested `rawSql` — this is the vendor README's pattern:

```ts
import { rawSql, sql } from 'remix/data-table'

let rows = await db.exec(
  sql`select id from uploads where id = ANY(${rawSql('?', [ids])}::int[])`,
)
// => select id from uploads where id = ANY(?::int[]), values: [ids]
```

Do **not** interpolate the array directly into `ANY(...)`: the expansion wins and turns the array into a record/scalar. Raw `db.exec(text, values)` still binds one value per placeholder, so `db.exec('... id = ANY($1::int[])', [ids])` remains correct and needs no change.

### 2. Composed fragments: only same-copy `sql`/`rawSql` statements inline

`sql` now tracks template fragments in a module-local `WeakSet`. A statement from `sql`/`rawSql` in the same loaded package copy is inlined (text + values); a copied, JSON-round-tripped, hand-built, or other-copy statement is bound as **one parameter** (a record). Rehydrate it instead:

```ts
import { rawSql } from 'remix/data-table'

let statement = rawSql(copied.text, copied.values)
await db.exec(sql`select * from users where ${statement}`)
```

### 3. JSON columns: pass JavaScript values, never pre-serialized strings

`c.json()` now stores `JSON.stringify(value)` for every non-null value. Write the value itself:

```ts
await db.create(lists, { ..., list: items })                 // ✅ serialized once by the column
await db.create(offeringConfigs, { ..., rules })             // ✅
await db.query(lists).where({ id }).update({ list: items })  // ✅
```

Keep `JSON.stringify` only where the value is a **raw SQL parameter with an explicit cast**, because the raw path bypasses column encoding:

```ts
await db.exec('insert into offering_configs (rules) values ($1::jsonb)', [JSON.stringify(rules)])
```

Reads: PostgreSQL `jsonb` arrives parsed (the mysql/sqlite drivers now decode json text through their `decodeValue` hook). Keeping a `typeof value === 'string'` parse in `afterRead` is harmless as a legacy-row fallback, but do not rely on it for new writes. Because a stale write path can nest one layer deeper, unwrap in a loop (`while (typeof value === 'string')`) and then normalize a non-container to the shape the caller expects (`[]` / `{}`); a single `if` lets a triple-encoded string or an object payload reach code that iterates it.

**Existing data:** rows written before 3.3.0 are single-encoded and read correctly. A row written on 3.3.0 with the old pre-serialization is double-encoded; detect it with `jsonb_typeof(column) = 'string'` and unwrap once (`(column #>> '{}')::jsonb`) if any such writes landed. This app ships that repair as `db/migrations/20261119120000_unwrap_double_encoded_json` — a per-row loop that only touches text starting with `[`/`{`, warns instead of aborting on unparseable text, and is a no-op on clean data. The read guards make the migration non-blocking: a missed row degrades to empty instead of a 500.

**Read-side guard:** every query that calls `jsonb_array_length(col)` / `jsonb_array_elements(col)` on user data must wrap the column in `CASE WHEN jsonb_typeof(col) = 'array' THEN col ELSE '[]'::jsonb END` (and a record column in the equivalent `'{}'` form). One malformed or double-encoded row otherwise 500s the whole page. `app/data/admin-lists.ts` and `app/data/lists.ts` both do this; keep the `SELECT` of a filtered page normalized too, or a strict row schema rejects the row before the SQL guard can help.

## When to Use

- You are writing `` = ANY(${array}) `` or `in ${array}` in a `sql` tag on the 3.3.0+ pin.
- A `data-table` call accepts a `SqlStatement` built elsewhere (cached, copied, deserialized, or imported from another package copy).
- A `c.json()` column write still calls `JSON.stringify` from the pre-3.3.0 pattern, or a read errors with `array length/elements of a scalar`.
- A read computes counts over a `jsonb` array column that holds user data — guard it with the `jsonb_typeof` CASE before `jsonb_array_length`/`jsonb_array_elements`.
- A raw-SQL JSON write casts to `jsonb` — keep `JSON.stringify` there and nowhere else.

## Related

- `raw-sql-sort-filter.md` (this index) — composing `WHERE`/`ORDER BY` fragments with `rawSql`
- `row-adapter.md` (this index) — narrowing the `unknown` json column on reads
- Vendor `node_modules/remix/src/data-table/README.md` §"Execute Raw SQL" — the canonical `any(${rawSql('?', [[...]])})` example and the one-value-per-placeholder rule for `db.exec(text, values)`
