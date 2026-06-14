---
title: "Shared afterRead Normalization for BIGINT/String Mismatch"
tags: [remix3, data-table, postgres, schema, refactor]
created: 2026-06-03
status: archived
---

## Problem

When PostgreSQL `BIGINT` columns are mapped to `c.integer()` in `remix/data-table` schema definitions, the `pg` driver returns BIGINT values as strings. Every table's `afterRead` hook duplicated the same `parseInt` boilerplate:

```ts
// Repeated 9 times across schema.ts
afterRead({ value }) {
  if (typeof value.created_at === 'string') value.created_at = parseInt(value.created_at, 10)
  if (typeof value.updated_at === 'string') value.updated_at = parseInt(value.updated_at, 10)
  return { value }
}
```

This duplication meant:
- Adding a new BIGINT column could be forgotten in afterRead
- Every table had slightly different field lists (some missed `admin_user_id`, others missed `resource_id`)
- Changing the parsing logic required touching 9 hooks

## Solution

Extract a variadic helper that mutates the value in-place:

```ts
// schema-utils.ts
export function parseIntFields(value: Record<string, unknown>, ...fields: string[]): void {
  for (let field of fields) {
    if (typeof value[field] === 'string') {
      value[field] = parseInt(value[field] as string, 10)
    }
  }
}
```

Then call it as a one-liner in every `afterRead`:

```ts
afterRead({ value }) {
  parseIntFields(value, 'created_at', 'updated_at', 'date', 'resource_id')
  if (typeof value.during === 'object' && value.during !== null) {
    let r = value.during as { lower: unknown; upper: unknown }
    value.during = `[${r.lower},${r.upper})`
  }
  return { value }
}
```

## Why

- **Single source of truth**: The field list per table is now an explicit argument — you can't accidentally omit a column.
- **DRY**: Changing parsing strategy (e.g., switching to `Number()` vs `parseInt`) is one edit.
- **Discoverable**: A new developer sees `parseIntFields(value, 'created_at', 'updated_at')` and immediately knows those columns need normalization.
- **Auditable**: A grep for `parseIntFields` finds all normalization sites vs searching for `typeof value.X === 'string'` patterns.
