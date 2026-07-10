---
name: remix-database-errors
description: PostgreSQL constraint violation handling for Remix 3 admin controllers. Activate when catching DB errors in try/catch blocks, handling foreign key or restrict violations, or converting JSON error responses to page re-renders.
---

# Remix Database Errors — Constraint Violations

Use this skill when handling PostgreSQL errors in Remix controllers, especially:

- Catching constraint violations in destroy/update/create actions
- Converting JSON error responses to page re-renders with `formError`
- Logging server-side errors for debugging

## The Problem: DataTableAdapterError Wrapping

Remix's `@remix-run/data-table-postgres` adapter wraps native `pg` errors in a `DataTableAdapterError`. The original PostgreSQL error details (including the error `code`) are nested in the `.cause` property:

```typescript
try {
  await db.deleteMany(resources, { where: { id } })
} catch (error: unknown) {
  // error.code = 'DATA_TABLE_ADAPTER_ERROR'     ← adapter wrapper
  // error.cause.code = '23001'                   ← actual PG error
}
```

## Shared Utility: `app/utils/db-errors.ts`

```typescript
const PG_RESTRICT_VIOLATION = '23001' as const
const PG_FOREIGN_KEY_VIOLATION = '23503' as const

export function isConstraintViolation(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; cause?: { code?: string } }
    // Check top-level (raw pg error)
    if (err.code === PG_RESTRICT_VIOLATION || err.code === PG_FOREIGN_KEY_VIOLATION) return true
    // Check nested (DataTableAdapterError wrapping)
    if (err.cause?.code === PG_RESTRICT_VIOLATION || err.cause?.code === PG_FOREIGN_KEY_VIOLATION)
      return true
  }
  return false
}
```

**PostgreSQL error codes to check for:**

- `23001` — `RESTRICT_VIOLATION` (ON DELETE RESTRICT is in use)
- `23503` — `FOREIGN_KEY_VIOLATION` (generic FK constraint)

Always check BOTH codes. `ON DELETE RESTRICT` produces `23001`, not `23503`.

### Exclusion Constraint Violations (`23P01`)

PostgreSQL exclusion constraints (e.g., preventing double-booked appointments via `EXCLUDE USING GIST`) produce error code `23P01`. These can be identified by the constraint name or the error code:

```typescript
const PG_EXCLUSION_VIOLATION = '23P01'

function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; message?: string; constraint?: string }
    return (
      err.constraint === 'no_overlapping_seats' ||
      err.code === PG_EXCLUSION_VIOLATION ||
      (err.message ?? '').includes('conflicts with key')
    )
  }
  return false
}
```

When using a data-table adapter that wraps errors, unwrap the cause chain to find the original PostgreSQL error:

```typescript
export function isExclusionViolation(error: unknown): boolean {
  let cause: unknown = error
  while (cause instanceof Error && 'cause' in cause && cause.cause != null) {
    cause = (cause as Error).cause
  }
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    (cause as { code: string }).code === PG_EXCLUSION_VIOLATION
  )
}
```

### DataTableAdapterError: Additional API differences

When using `Database.exec()` from `remix/data-table` (via `createPostgresDatabaseAdapter`), the `DataManipulationResult` returned differs from raw `PoolQueryResult`:

- **`result.rows` is nullable** — always use `result.rows ?? []`
- **`result.affectedRows`** replaces `PoolQueryResult.rowCount` — use `result.affectedRows ?? 0`
- **No `.rowCount`** — use `.affectedRows` instead
- **TypeScript strict casting**: cast `Record<string, unknown>[]` through `unknown`: `(result.rows ?? []) as unknown as MyType[]`

> _Consolidated from: remix-data-table-adapter-error-unwrapping_

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
        offset: gridStateOffset(gridValues),
        sortColumn: gridStateSort(gridValues),
        sortDirection: gridStateDirection(gridValues),
        filter: gridStateFilter(gridValues),
      })
      return renderPage(context, data, { status: 400 })
    }
    throw error  // Unexpected errors still propagate
  }

  // ... success: redirect ...
}
```

The page component needs a `formError` prop and a banner in the grid section:

````tsx
interface AdminPageProps {
  formError?: string
}

let gridSection = (
  <div mix={table.minWidth0}>
    {formError ? <div mix={table.errorBanner}>{formError}</div> : null}
    {/* ... */}
  </div>
)

---

## PostgreSQL BIGINT Returned as String via Raw SQL

PostgreSQL's `BIGINT`/`int8` columns are returned as **strings** by the Node.js `pg` driver in raw SQL query results. This breaks `new Date()`, strict equality (`===`), and arithmetic.

Always wrap `BIGINT` values with `Number()` when consuming from raw SQL results:

```typescript
// ❌ BUG: string epoch → "Invalid Date"
new Date(row.day).toLocaleDateString('de-DE')

// ✅ FIX: Number() coerces string → number
new Date(Number(row.day)).toLocaleDateString('de-DE')
````

For bulk conversion, use a utility:

```typescript
function parseIntFields(value: Record<string, unknown>, ...fields: string[]): void {
  for (let field of fields) {
    if (typeof value[field] === 'string') {
      value[field] = parseInt(value[field] as string, 10)
    }
  }
}
```

**When to use:** Consuming `BIGINT`/`int8` columns via raw SQL in Node.js (`pool.query`, `db.exec`), especially epoch-ms timestamps.

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

```

```
