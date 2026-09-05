---
name: remix3-data-table-row-adapter
description: "Use when remix/data-table typed queries (db.findMany/db.findOne/db.create returnRow) won't assign to a concrete UI row type because json/bigint columns are typed unknown, or when a data-module row type and a UI row type for one entity drift apart — consolidate to one canonical row interface and narrow unknown columns at a single toXxxRow adapter instead of as-unknown-as casts"
metadata:
  origin: auto-extracted
---

# Remix Data-Table: Narrow Unknown Columns at One Row Adapter

**Extracted:** 2026-09-04
**Context:** Remix 3 + `remix/data-table`. A typed query result (`TableRow<typeof table>`) cannot be assigned to the concrete UI row type, forcing `as unknown as SomeRow` at every call site.

## Problem

Even the **typed query API** — `db.findMany`, `db.findOne`, `db.create(..., { returnRow: true })` — returns `TableRow<typeof table>` where json and bigint columns are typed `unknown`. In `@remix-run/data-table`, `ColumnBuilder<output = unknown>` and `column.json()` / `column.bigint()` return the default builder, so their `ColumnOutput` is `unknown` (`dist/lib/column.d.ts`). Only `integer()/text()/enum()` carry concrete types (`number`/`string`/union):

```ts
// TableRow<typeof lists>:
//   id: number, title: string, description: string,
//   list: unknown,       // c.json() → ColumnBuilder<unknown>
//   created_at: number,  // repo bigint() helper already casts to number
let rows = await db.findMany(lists, { ... })   // Array<TableRow<typeof lists>>
let out: ListRow[] = rows                      // ❌ unknown not assignable to ListRow['list']
```

Symptoms that lead here: `list: unknown` not assignable, repetitive `as unknown as ListRowData[]` at each `db.findMany`/`db.findOne`, or two hand-written row interfaces for one entity (a `...Row` in the data module and a `...RowData` in the UI page) silently drifting apart.

## Solution

Own one canonical row interface where the rows are produced, then narrow the vendor `unknown` columns at a **single** adapter boundary. Callers stop casting.

1. **Consolidate duplicate interfaces.** Replace the data-module row type and the UI-page row type with one `interface ListRow` in the module that produces the rows (e.g. `app/data/admin-lists.ts`); import that type everywhere instead of re-declaring it.

2. **Export one adapter** that takes the raw `TableRow<typeof table>` and returns the canonical row, narrowing `unknown` columns with guards:

```ts
import { rawSql, type Database, type TableRow } from 'remix/data-table'
import type { lists } from './schema.ts'   // type-only: 'lists' appears only in `typeof`, else lint/verbatimModuleSyntax errors

export function toListRow(row: TableRow<typeof lists>): ListRow {
  return { id: row.id, title: row.title, description: row.description,
           list: toListItems(row.list),           // narrow the unknown json column
           created_at: row.created_at, updated_at: row.updated_at }
}
```

3. **Route every typed-API result through it** — no casts at call sites:

```ts
let rows = (await db.findMany(lists, { ... })).map(toListRow)
let editRow = found ? toListRow(found) : null
```

Adjacent gotchas this fixes in the same stroke:
- `TableRow<typeof table>` needs the **table value only in a type position**, so import it `import type { table }`; `@typescript-eslint/consistent-type-imports` (and `verbatimModuleSyntax`) errors otherwise.
- Keep guards inside the adapter (`Array.isArray` + per-element `typeof` checks for json arrays) — it's the boundary, so it's the one place to be defensive.
- With `exactOptionalPropertyTypes`, build optional fields conditionally (`...(cond ? { done: x } : {})`) rather than assigning `undefined`.
- If the table declares bigint via a repo `bigint()` helper cast (`c.bigint() as unknown as ColumnBuilder<number>`), timestamps are already `number`; a raw `c.bigint()` yields `unknown` and needs narrowing too.

## When to Use

- `db.findMany` / `db.findOne` / `db.create(returnRow)` results won't assign to a concrete UI/props row type without `as unknown as`.
- Two hand-written row interfaces describe the same entity (data layer vs UI layer) and drift.
- You want a single, checked boundary where remix/data-table's `unknown` json/bigint columns are narrowed, instead of casts scattered across call sites.
