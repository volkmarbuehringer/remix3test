---
name: postgres-raw-sql-bigint-string
description: "PostgreSQL pg driver returns BIGINT/int8 columns as strings via raw SQL queries"
user-invocable: false
origin: auto-extracted
---

# PostgreSQL BIGINT Returned as String via Raw SQL

**Extracted:** 2026-06-05
**Context:** When using `pool.query()`, `db.exec()`, or any raw SQL in Node.js with the `pg` driver

## Problem
PostgreSQL's `BIGINT`/`int8` columns are returned as **strings** by the Node.js `pg` driver in raw SQL query results. Calling `new Date(bigintValue)` produces `"Invalid Date"` because `Date` does not parse numeric epoch strings. This also breaks strict equality checks (`===`), arithmetic, and typed comparisons.

## Solution
Always wrap `BIGINT` values with `Number()` when consuming from raw SQL results, or apply a coercion utility:

```typescript
// ❌ BUG: string epoch → "Invalid Date"
new Date(row.day).toLocaleDateString('de-DE')

// ✅ FIX: Number() coerces string → number
new Date(Number(row.day)).toLocaleDateString('de-DE')
```

For bulk conversion, use a utility function:

```typescript
function parseIntFields(value: Record<string, unknown>, ...fields: string[]): void {
  for (let field of fields) {
    if (typeof value[field] === 'string') {
      value[field] = parseInt(value[field] as string, 10)
    }
  }
}
```

## When to Use
- Querying `BIGINT`/`int8` columns with raw SQL (`pool.query`, `db.exec`, etc.) in Node.js
- Consuming epoch-millisecond timestamps stored as `BIGINT`
- Comparing integer values from the database with `===`
- Feeding database values into `Date`, `Math`, or typed APIs
