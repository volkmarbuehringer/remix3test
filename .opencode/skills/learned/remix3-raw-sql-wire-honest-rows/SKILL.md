---
name: remix3-raw-sql-wire-honest-rows
description: "Decode remix/data-table db.exec results with wire-honest zod schemas (int4→number, int8→string, aggregates coerced) instead of force-casting to drifting row interfaces"
user-invocable: false
origin: auto-extracted
---

# Remix Data-Table: Wire-Honest Row Decoding for Raw SQL

**Extracted:** 2026-09-04
**Context:** Remix 3 + `remix/data-table` + `zod` v4. When `db.exec` returns untyped rows and you reach for `as unknown as SomeRow[]`.

## Problem

`db.exec` (raw SQL) returns `rows?: Record<string, unknown>[]` — untyped by design (vendor `data-table/src/lib/driver.ts`). Force-casting onto hand-written interfaces lets them silently drift from the real pg wire shape, and the compiler never notices because `unknown` accepts anything. Concrete drift found in this repo:

- `AppointmentRow.id` typed `string`, but the column is `int4` (SERIAL) → pg returns `number`
- `WebhookRequestRow.created_at` typed `number`, but the column is `int8` (BIGINT) → pg returns `string`
- Consumers compensate with workarounds like `parseInt(row.id, 10)` on a value that's already a number

There are two row universes that casts blur together:
- **Wire rows** — raw `db.exec` output, no `afterRead`/`parseIntFields` hooks applied, pg-native types
- **Domain rows** — the typed query API (`db.findMany`/`TableRow`), hooks applied, timestamps already `number`

## Solution

Wrap `db.exec` in a small helper that zod-parses every returned row (see `app/data/rows.ts` in this repo):

```typescript
import { z } from 'zod/v4'
import type { Database, SqlStatement } from 'remix/data-table'

export const int8Aggregate = z.coerce.number() // count/sum/min/max/avg over int8

export async function queryRows<Schema extends z.ZodType>(
  db: Database, statement: string | SqlStatement, schema: Schema,
): Promise<z.output<Schema>[]> { /* db.exec + schema.parse per row */ }

export async function queryRow<Schema extends z.ZodType>(
  db: Database, statement: string | SqlStatement, schema: Schema,
): Promise<z.output<Schema> | undefined> { /* first row or undefined */ }
```

Pass either the `sql` tag or `rawSql(text, values)` (for dynamically built SQL) as the statement. On a mismatch, throw an error naming the statement + row index so drift surfaces loudly in dev/test instead of shipping wrong data.

**Wire-honest schema rules** (mirror pg, don't normalize):
- `int4` columns (id, `*_id`, `start_min`) → `z.number()`
- `int8` columns (timestamps, `date`) → `z.string()`
- Aggregates (`count(*)`, `min`/`max`/`sum`/`avg` over int8, `::numeric` results) → `int8Aggregate`
- **Check `db/schema.sql` first** — not every `id` is int4: `webhook_requests.id` is `UUID` → `z.string()`
- JSONB columns → `z.record(...)` / `z.array(...)` / `z.unknown()`; opaque bytea → `z.custom<Buffer>()`

Replace hand-written interfaces with `type Row = z.output<typeof rowSchema>` — the schema is the single source of truth. When a consumer needs the *domain* shape (timestamps as numbers), decode wire rows then map explicitly:

```typescript
let rows = (await queryRows(db, sql`...`, wireSchema)).map(toDomainRow)
```

## When to Use

- Adding a new raw-SQL join/aggregate query and about to write `as unknown as SomeRow[]`
- A hand-written row interface has drifted from its SQL (typed `string`/`number` mismatch with the actual column type)
- The Mastra tool boundary: `db.exec(...).map((r: any) => ...)` — decode wire rows first, then map to the tool's output shape (int8 fields must stay string-tolerant there; see `postgres-gotchas`)