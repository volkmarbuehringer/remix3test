---
name: postgres-limit-without-order
description: "SELECT LIMIT 1 without ORDER BY returns an arbitrary physical row in PostgreSQL, not the first inserted. Add ORDER BY or a filtering WHERE to make it deterministic."
user-invocable: false
origin: auto-extracted
---

# PostgreSQL: `LIMIT 1` Without `ORDER BY` Is Non-Deterministic

**Extracted:** 2026-06-04
**Context:** `createAuthCookieWithCsrf()` used `SELECT id FROM users LIMIT 1` to find an admin user for tests. After e2e tests accumulated users, it started returning non-admin rows, causing all admin controller tests to fail with 403.

## Problem

`SELECT ... LIMIT 1` without an `ORDER BY` clause returns an **arbitrary** physical row from the table, not the first one inserted. The physical order depends on PostgreSQL's internal storage layout and changes as rows are inserted, deleted, updated, or vacuumed.

In test helpers, this manifests as intermittent failures when the helper expects a specific kind of row but gets a different one.

## Solution

Always pair `LIMIT` with `ORDER BY` or a filtering `WHERE`:

```ts
// ❌ Non-deterministic — returns an arbitrary row
let result = await pool.query('SELECT id FROM users LIMIT 1')

// ✅ Deterministic — always returns the first admin
let result = await pool.query(
  'SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1',
  ['admin']
)
```

## When to Use

- Tests fail intermittently or only after multiple runs (accumulated test data changes row layout)
- A `LIMIT 1` query is used to find a "first" or "default" row in a test helper
- Admin/role-based tests fail with 403 despite using the correct credentials
- Debugging shows the query returns a different row than expected
