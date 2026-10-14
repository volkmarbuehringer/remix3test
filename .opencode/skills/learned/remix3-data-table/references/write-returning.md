# Return the Row You Wrote (data-table RETURNING)

**Extracted:** 2026-10-14
**Context:** A write helper needs the inserted/updated row (to return to the caller, or to detect an optimistic-concurrency miss) and is about to add a follow-up `findOne`.

## Problem

`data-table` writes have several return shapes, and the wrong one costs a round-trip or hides a miss:

- `db.create(table, values, { returnRow: true })` returns the inserted row (capability-gated `RETURNING`; the plain form returns `WriteResult`).
- `db.createMany(table, values, { returnRows: true })` returns the inserted rows (MySQL lacks `returning` and throws `DataTableQueryError`).
- `db.update(table, pk, changes)` returns the updated row, but **throws** `DataTableQueryError` when the target is missing.
- `db.query(table).where(...).update(changes, { returning: '*' })` returns `{ rows }` and does **not** throw on zero matched rows.
- `db.updateMany(table, changes, { where })` returns `WriteResult` only; it has no `returning` option.

## Solution

### 1. Ask for the row at write time

```ts
let created = await db.create(notifications, values, { returnRow: true })

let result = (await db.query(lists).where(updateWhere).update(fields, {
  returning: '*',
})) as { rows: Array<Record<string, unknown>> }
let updated = result.rows[0]
if (updated === undefined) {
  // no row matched the WHERE: a missing row, or a stale If-Match predicate
}
```

`rows[0] === undefined` is the miss signal for the query-builder form; the `db.update` helper throws instead, so use `.update(..., { returning: '*' })` when "no match" is an expected branch (optimistic concurrency, ownership-scoped writes).

### 2. Returned write rows already ran `afterRead`

The vendor README: "`afterRead` runs for each loaded row (root rows, eager-loaded relation rows, and write-returning rows)." A repo adapter applied on top must be idempotent:

```ts
function parseRow(row) {
  let list = row.list
  if (typeof list === 'string') list = JSON.parse(list) // may already be parsed
  return { id: Number(row.id), updated_at: Number(row.updated_at), list, ... }
}
```

Do not assume a returned row is raw: int8 columns are already numbers and json columns may already be parsed.

### 3. Keep only the observation the conflict path needs

In `patchList`, `returning: '*'` removes the trailing `findOne`, but the `If-Match` path still needs one read: it compares `updated_at` before writing and builds the 409 `current` payload. Only the read of the row you just wrote is redundant.

### 4. Gate on the capability

`createPostgresDatabase`/`createSqliteDatabase` report `returning: true`; MySQL reports `returning: false`. Branch or document Postgres-only when both must be supported.

## When to Use

- A write helper does `INSERT … RETURNING id` and then re-selects the full row.
- A write helper does `updateMany`/`update` and then `findOne` to return the updated row.
- An optimistic-concurrency (If-Match/ETag) update must know whether its predicate matched.
- You are about to hand-write `RETURNING` in raw SQL where a typed helper exists.

## Related

- `references/row-adapter.md` — narrowing `unknown` json/bigint columns from typed results
- `database-gotchas` — int8/int4 wire types (`references/raw-sql-wire-honest-rows.md`)
