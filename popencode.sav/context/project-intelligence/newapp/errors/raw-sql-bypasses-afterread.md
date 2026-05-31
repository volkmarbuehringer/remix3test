<!-- Context: project-intelligence/newapp/errors/raw-sql-bypasses-afterread | Priority: high | Version: 1.0 | Updated: 2026-05-22 -->

# Error: Raw SQL Bypasses `afterRead` — BIGINT Strings Leak Through

**Severity**: 🔴 High — silent data corruption: `new Date(string)` returns Invalid Date

---

## The Problem

The `pg` driver returns `BIGINT` columns as **strings** (JS numbers lose precision beyond `2^53`). The `data-table` schema's `afterRead` hook normally converts these with `parseInt()`/`Number()`:

```ts
// app/data/schema.ts — lists table
afterRead({ value }) {
  if (typeof value.created_at === 'string') {
    value.created_at = parseInt(value.created_at, 10)
  }
  // ...
  return { value }
}
```

When you use `context.db.findMany(lists, ...)` or similar `data-table` methods, the framework calls `afterRead` automatically — timestamps arrive as proper numbers.

**The trap**: Raw `pool.query()` (or `db.exec()`) bypasses `afterRead` entirely. The rows come straight from `pg` with BIGINTs as strings.

## Detection

```ts
new Date('1745280000000')      // ❌ Invalid Date — string!
new Date(Number('1745280000000'))  // ✅ Valid Date — number
```

If a `<AdminListsPage>` or any component passes a timestamp directly to `new Date()`, a string BIGINT silently produces `Invalid Date` and `toLocaleDateString()` returns `"Invalid Date"`.

## The Fix

After every raw `pool.query()`, explicitly convert BIGINT columns:

```ts
// After raw SQL query (app/actions/admin-lists-controller.tsx line 41-45)
rows = result.rows.map((row: Record<string, unknown>) => ({
  ...row,
  created_at: typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at,
  updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : row.updated_at,
}))
```

### Helper Pattern

For controllers with many BIGINT columns, extract a reusable helper:

```ts
function fixBigintTimestamps<T>(row: T, ...timestampCols: (keyof T)[]): T {
  let next = { ...row }
  for (let col of timestampCols) {
    let val = next[col]
    if (typeof val === 'string') (next as any)[col] = Number(val)
  }
  return next
}

// Usage:
rows = result.rows.map((row) => fixBigintTimestamps(row, 'created_at', 'updated_at'))
```

## When It Happens

Any code path that uses `pool.query()` or `db.exec()` directly on tables with `BIGINT` columns:

| Table | Affected Columns | Controllers |
|-------|-----------------|-------------|
| `lists` | `created_at`, `updated_at` | `admin-lists-controller.tsx` (raw query for GIN filter) |
| `nutzer` (no BIGINT cols) | — | `admin-nutzer-controller.tsx` (safe — timestamps are INT not BIGINT) |
| `chatlog` | `created_at`, `updated_at` | Any raw query against chatlog |
| `clients` | `registered` | admin-nutzer or others doing raw queries |

## Why This Exists

The admin-lists GIN filter cannot use `data-table`'s `findMany()` because the filter query involves:
- `ILIKE` on `description` (data-table doesn't support ILIKE)
- `jsonb_array_elements()` cross-join (data-table doesn't support JSONB unnest)
- `EXISTS` subquery (data-table doesn't support correlated subqueries)

These features require raw SQL. The trade-off is losing `afterRead`. Every controller that uses raw SQL on tables with BIGINT columns **must** handle the conversion manually.

## Prevention

1. **Before writing raw SQL**: Check if the table has BIGINT columns in `schema.ts` → `afterRead`
2. **After writing raw SQL**: Map rows and convert every BIGINT column referenced in `afterRead`
3. **Test**: Assert `typeof row.created_at === 'number'` after raw queries
4. **Review**: Any `pool.query()` call in a controller is a red flag for `afterRead` bypass

## 📂 Codebase References

- **Bug discovered**: `app/actions/admin-lists-controller.tsx` — raw SQL for GIN filter needed manual `Number()` conversion (lines 41-45)
- **Schema with afterRead**: `app/data/schema.ts` — `lists.afterRead()`, `clients.afterRead()`, `chatlog.afterRead()`, `workflowRuns.afterRead()` all fix BIGINT strings
- **Nutzer pattern**: `app/actions/admin-nutzer-controller.tsx` — also uses raw SQL but on tables with no BIGINT timestamps (INT instead)
- **Setup**: `app/data/setup.ts` — `CREATE TABLE` statements all use `BIGINT` for timestamps

## Related

- [Database Architecture](../concepts/database-architecture.md) — `afterRead` section shows the hook pattern
- [Known Issues](../lookup/known-issues.md) — afterRead bypass entry
- [Admin Filter Pattern](../guides/admin-filter-pattern.md) — Raw SQL trade-off for GIN search
- [Database Optimization](../concepts/database-optimization.md) — Indexing strategy with `pg_trgm`
