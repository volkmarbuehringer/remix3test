---
name: remix-data-table-adapter-error-unwrapping
description: "Unwrap DataTableAdapterError.cause when checking PostgreSQL errors from remix/data-table db.exec()"
origin: auto-extracted
---

# DataTableAdapterError Cause Unwrapping for remix/data-table

**Extracted:** 2026-07-04
**Context:** Remix 3 apps using `remix/data-table` with the PostgreSQL adapter where `db.exec()` wraps PG errors in `DataTableAdapterError` with the original error nested in `.cause`.

## Problem

When using `Database.exec()` from `remix/data-table` (via `createPostgresDatabaseAdapter`), PostgreSQL errors are wrapped in a `DataTableAdapterError` instead of being exposed directly. Functions that check for specific PG error codes or constraint names by inspecting the error surface (`error.code`, `error.constraint`) silently fail because those properties live on the **inner** error, not the wrapper.

For example, this pattern works with raw `pool.query()` but fails silently with `db.exec()`:

```ts
// Works with pool.query() — but NOT with db.exec():
function isExclusionConstraintError(error: unknown): boolean {
  return error?.code === '23P01'         // undefined on wrapper
      || error?.constraint === 'no_overlapping_seats'  // undefined on wrapper
}
```

The adapter error wraps the original PG error like this:
```
DataTableAdapterError ← { cause: { code: '23P01', constraint: 'no_overlapping_seats', ... } }
```

## Solution

Always unwrap `.cause` when checking PostgreSQL errors through `Database.exec()`. Both wrapper and cause should be checked to support both direct `pool.query()` and `db.exec()` callers:

```ts
function isExclusionConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as {
      code?: string
      message?: string
      constraint?: string
      cause?: {
        code?: string
        message?: string
        constraint?: string
      }
    }
    return (
      // Check wrapper surface (direct pool.query() callers, edge cases)
      err.constraint === 'no_overlapping_seats' ||
      err.code === '23P01' ||
      (err.message ?? '').includes('conflicts with key') ||
      // Check cause (DataTableAdapterError from db.exec())
      err.cause?.constraint === 'no_overlapping_seats' ||
      err.cause?.code === '23P01' ||
      (err.cause?.message ?? '').includes('conflicts with key')
    )
  }
  return false
}
```

### Key observations

- `DataManipulationResult.rows` is **nullable** (`rows?: Record<string, unknown>[]`) — always use `result.rows ?? []`
- `DataManipulationResult.affectedRows` replaces `PoolQueryResult.rowCount` — use `result.affectedRows ?? 0`
- `DataManipulationResult` has no `.rowCount` — use `.affectedRows` instead
- TypeScript strict casting: cast `Record<string, unknown>[]` through `unknown`: `(result.rows ?? []) as unknown as MyType[]`

## When to Use

- Adding error-handling utilities that check PostgreSQL error codes (constraint violations, exclusion violations, foreign key violations)
- Migrating controllers from `pool.query()` to `db.exec()` and discovering that constraint-error handling tests fail
- Building new repository functions in `app/data/` that catch database errors for user-facing messages