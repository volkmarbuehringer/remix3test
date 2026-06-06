---
title: "PostgreSQL exclusion constraints for double-booking prevention"
tags: [postgres, appointments, scheduling, exclusion-constraint, gist, double-booking, migration]
created: 2026-05-31
status: active
---

## Problem

Appointment/offering systems need to prevent overlapping bookings for the same resource at the same time. Application-level checks (SELECT before INSERT) have race conditions — two concurrent requests can both pass the check before either commits.

## Solution

Use PostgreSQL **exclusion constraints** with GiST indexes to enforce non-overlap at the database level. Combined with `int4range` for time slots and `GENERATED ALWAYS AS` columns for computed values:

```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  date BIGINT NOT NULL,           -- epoch ms for the day
  during int4range NOT NULL,      -- [start_min, end_min) e.g. [480, 1020)
  start_min INTEGER GENERATED ALWAYS AS (lower(during)) STORED,
  end_min INTEGER GENERATED ALWAYS AS (upper(during)) STORED,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
    resource_id WITH =,
    date WITH =,
    during WITH &&
  )
)
```

**Key pieces:**
- `int4range` stores the time range as minutes since midnight (e.g. `[480,1020)` = 08:00-17:00)
- `GENERATED ALWAYS AS (lower(during)) STORED` keeps `start_min`/`end_min` in sync without application logic
- `EXCLUDE USING GIST` prevents any two rows where `resource_id`, `date`, and `during` overlap (`&&`)
- `ON DELETE RESTRICT` on `resource_id` prevents deleting a resource with existing appointments

**Error detection on the application side:**

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

When using a data-table adapter that wraps errors, unwrap the cause chain:

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

## Why

Application-level overlap checks are inherently racy — between the SELECT and INSERT, another request can insert an overlapping row. Exclusion constraints are **atomic**: the database checks the condition at insert time within the same transaction, so no race is possible. The GiST index also serves as a query performance index for range queries on `during`.

The `GENERATED ALWAYS AS` columns eliminate drift between the `during` range and the exposed `start_min`/`end_min` — they are always derived from the single source of truth. No application code can set them to inconsistent values.
