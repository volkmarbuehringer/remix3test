---
title: "Safe SQL ORDER BY with lookup maps and pg.Pool configuration"
tags: [sql, postgres, security, pool, remix3, admin, controllers, order-by]
created: 2026-05-31
status: active
---

## Problem

Two database-related issues in Remix 3 admin controllers:

**C1 — Dynamic ORDER BY with string interpolation:** Column names from URL params were interpolated directly into SQL queries via template strings (`ORDER BY ${column} ${direction}`). While validated against an allow-list, this pattern is fragile — if a column name with special characters enters the allow-list, or validation logic has a bug, it becomes a SQL injection vector. Found in `admin-appointments-controller.tsx`, `admin-offerings-controller.tsx`, `admin-nutzer-controller.tsx`.

**C2 — No connection pool configuration:** The `pg.Pool` was created with only a `connectionString`, relying on defaults (max 10 connections, no idle timeout, no connection timeout). In production under concurrent load, this risks connection exhaustion, stuck connections, and hung queries.

## Solution

**C1 — Replace direct column interpolation with a safe lookup map:**

Instead of passing the column name directly from URL param into the SQL string, define a `Record<string, string>` map that maps short, safe keys to SQL column expressions. Use the map's keys for `parseSort` validation, then resolve via the map:

```typescript
// Before: fragile interpolation
const SORTABLE_COLUMNS = ['a.id', 'a.title', /* ... */] as const
// ...
query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`

// After: lookup map — no user input in SQL string
const ORDER_BY_COLUMNS: Record<string, string> = {
  'a.id': 'a.id',
  'a.title': 'a.title',
  // ...
}
// ...
query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'a.date'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
```

The `parseSort` utility validates against the map keys:
```typescript
let { column, direction } = parseSort(context.url, {
  allowedColumns: Object.keys(ORDER_BY_COLUMNS),
  defaultColumn: 'a.date',
  defaultDirection: 'asc',
})
```

One controller (`admin-offering-configs-controller.tsx`) already used this pattern — it was the reference implementation.

**C2 — Configure pool with explicit limits:**

```typescript
export const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,                    // Max connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000,  // Fail fast if can't connect
  maxUses: 7500,              // Recycle connections to avoid memory leaks
})
```

## Why

**C1:** The lookup map pattern ensures that even if the allow-list validation is bypassed or a column name containing special characters (parentheses, quotes, semicolons) is somehow accepted, the SQL query still only contains the exact expression the developer intended. The URL parameter is never directly part of the SQL string — it's just a key into a controlled map with a safe fallback.

**C2:** Pool defaults are tuned for small, low-concurrency apps. Production apps need explicit limits to:
- Prevent connection exhaustion under load (`max`)
- Release idle connections back to the database (`idleTimeoutMillis`)
- Fail fast instead of hanging when the database is unreachable (`connectionTimeoutMillis`)
- Recycle connections periodically to prevent memory leaks in the pg driver (`maxUses`)
