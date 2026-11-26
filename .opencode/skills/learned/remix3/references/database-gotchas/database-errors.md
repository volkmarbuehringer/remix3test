# Remix Database Errors — Constraint Violations

**Source:** `remix-database-errors`

Use this skill when handling PostgreSQL errors in Remix controllers, especially:

- Catching constraint violations in destroy/update/create actions
- Converting JSON error responses to page re-renders with `formError`
- Logging server-side errors for debugging

## The Problem: DataTableDatabaseError Wrapping

`@remix-run/data-table`'s `Database` layer (`#executeOperation` in `@remix-run/data-table/src/lib/database.ts`) wraps native `pg` errors in a `DataTableDatabaseError`. The original PostgreSQL error details (including the error `code`) are nested in the `.cause` property:

```typescript
try {
  await db.deleteMany(resources, { where: { id } })
} catch (error: unknown) {
  // error.name = 'DataTableDatabaseError'
  // error.code = 'DATA_TABLE_DATABASE_ERROR'    ← data-table wrapper
  // error.cause.code = '23001'                   ← actual PG error
}
```

## Shared Utility: `app/utils/db-errors.ts`

The repo's `app/utils/db-errors.ts` already implements cause-chain unwrapping and the predicate helpers. Use them directly:

- `isConstraintViolation(error)` — matches PG `23001` (`RESTRICT_VIOLATION`) and `23503` (`FOREIGN_KEY_VIOLATION`), walking the `.cause` chain.
- `isUniqueViolation(error)` — matches `23505`.
- `isExclusionConstraintError(error)` — matches `23P01`, the `no_overlapping_seats` / `no_overlapping_offerings` constraints, or a `conflicts with key` message.

**PostgreSQL error codes to remember:**

- `23001` — `RESTRICT_VIOLATION` (ON DELETE RESTRICT is in use)
- `23503` — `FOREIGN_KEY_VIOLATION` (generic FK constraint)
- `23505` — `UNIQUE_VIOLATION`
- `23P01` — `EXCLUSION_VIOLATION`

Always check BOTH `23001` and `23503`. `ON DELETE RESTRICT` produces `23001`, not `23503`. When using a data-table adapter that wraps errors, unwrap the cause chain to find the original PostgreSQL error (the helpers do this for you).

> _Consolidated from: remix-data-table-adapter-error-unwrapping_

### DataTableDatabaseError: Additional API differences

When using `Database.exec()` from `remix/data-table` (via `createPostgresDatabase`), the `DataManipulationResult` returned differs from raw `PoolQueryResult`:

- **`result.rows` is nullable** — always use `result.rows ?? []`
- **`result.affectedRows`** replaces `PoolQueryResult.rowCount` — use `result.affectedRows ?? 0`
- **No `.rowCount`** — use `.affectedRows` instead
- **TypeScript strict casting**: cast `Record<string, unknown>[]` through `unknown`: `(result.rows ?? []) as unknown as MyType[]`

## Structured Logging

Use structured logging instead of raw `console.error(error)`:

```typescript
// WRONG — dumps stack traces and raw error objects
console.error(error)

// RIGHT — provides context without stack noise
console.error('Constraint violation during resource deletion', {
  code: (error as { code?: string }).code,
  resourceId: id,
})
```

Use action-specific messages: "creation", "update", "deletion" to identify where the error occurred.

## Render on Error Instead of JSON

Convert JSON error responses to page re-renders with `formError`:

```typescript
async destroy(context) {
  let formData = context.formData
  let id = Number(context.params.id)

  // ... validation ...

  try {
    await db.deleteMany(resources, { where: { id } })
  } catch (error: unknown) {
    if (isConstraintViolation(error)) {
      console.error('Constraint violation during resource deletion', {
        code: (error as { code?: string }).code,
        resourceId: id,
      })
      let gridValues = gridStateFromFormData(formData)
      let data = await loadPageData(context, {
        formError: 'Ressource wird noch verwendet und kann nicht gelöscht werden',
        ...gridStateOverrides(gridValues),
      })
      return renderPage(context, data, { status: 400 })
    }
    throw error  // Unexpected errors still propagate
  }

  // ... success: redirect ...
}
```

The page component needs a `formError` prop and a banner in the grid section — see the admin grid pages (e.g. `app/ui/admin-lists-page.tsx`) for the `formError` banner pattern.

---

## PostgreSQL BIGINT Returned as String via Raw SQL

PostgreSQL's `BIGINT`/`int8` columns are returned as **strings** by the Node.js `pg` driver in raw SQL query results. This breaks `new Date()`, strict equality (`===`), and arithmetic.

Always wrap `BIGINT` values with `Number()` when consuming from raw SQL results:

```typescript
// ❌ BUG: string epoch → "Invalid Date"
new Date(row.day).toLocaleDateString('de-DE')

// ✅ FIX: Number() coerces string → number
new Date(Number(row.day)).toLocaleDateString('de-DE')
```

**When to use:** Consuming `BIGINT`/`int8` columns via raw SQL in Node.js (`pool.query`, `db.exec`), especially epoch-ms timestamps. (Also see `postgres-gotchas` Part 4.)

---

## Epoch-ms Granularity Comparison: UTC Midnight vs Wall-Clock

When you store dates as **UTC-midnight epoch ms** (`Date.UTC(2026, 5, 11)`) and filter with `stored_date >= Date.now()`, **today's entries are silently excluded** at any time past midnight UTC.

`Date.now()` returns wall-clock time (e.g., noon = `1768046400000`), which is always > midnight for the same day (`1768003200000`). The comparison `midnight >= noon` is `false` — no error, no exception, just missing data.

**Fix:** Compare against today's UTC midnight instead:

```typescript
let now = new Date()
let todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
query += ` AND a.date >= $${paramIndex}`
params.push(todayUtcMidnight)
```

For the **expired/past** filter, same principle — use `< todayUtcMidnight`:

```typescript
if (status === 'pending' || !status) {
  query += ` AND a.date >= $${paramIndex}`
  params.push(todayUtcMidnight) // includes today and future
} else if (status === 'expired') {
  query += ` AND a.date < $${paramIndex}`
  params.push(todayUtcMidnight) // excludes today (yesterday and older only)
}
```

**When to use:** Database columns storing epoch-ms dates at UTC day boundaries (BIGINT), SQL `WHERE` clauses filtering by "future"/"past", or comparing timestamps at different granularities.
