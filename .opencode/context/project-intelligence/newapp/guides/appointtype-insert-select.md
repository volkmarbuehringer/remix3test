<!-- Context: project-intelligence/newapp/guides/appointtype-insert-select | Priority: high | Version: 2.1 | Updated: 2026-05-25 -->

# Guide: AppointType INSERT…SELECT Pattern

**Purpose**: Create appointments from appointment types using a single `INSERT...SELECT` SQL statement that copies the title and `user_id` from the type, bypassing the ORM data-layer lifecycle hooks.

---

## Overview

When the user drags a type from the panel and drops it on the calendar grid, the client sends:

```json
POST /appointment
{
  "typeId": 7,
  "date": 1893456000000,
  "start_min": 540
}
```

The server detects `typeId` and runs a raw SQL `INSERT...SELECT` instead of using the `createAppointment()` data function:

```sql
INSERT INTO appointments (user_id, title, date, during, created_at, updated_at)
SELECT user_id, title, $1::bigint, int4range($2::integer, $2::integer + 60, '[)'), $3, $3
FROM appointtypes
WHERE id = $4 AND user_id = $5
RETURNING id
```

Parameters: `[$1: date, $2: start_min, $3: now, $4: typeId, $5: userId]`

**Note:** The `int4range()` constructor replaces the old separate `start_min`/`end_min` columns. The third argument `'[)'` means inclusive lower bound, exclusive upper bound — matching the standard `[start,end)` range semantics.

---

## The Pattern

The `create` action in `appointment-controller.tsx` has a fork at the top:

```tsx
async create(context) {
  // ...auth check, parse body...

  // BRANCH A: typeId present → INSERT...SELECT (raw SQL)
  if (typeof body.typeId === 'number') {
    // Validate required fields
    if (typeof body.date !== 'number' || typeof body.start_min !== 'number') {
      return Response.json(
        { error: 'date and start_min are required with typeId.' },
        { status: 400 },
      )
    }

    let now = Date.now()
    let result = await pool.query(
      `INSERT INTO appointments (user_id, title, date, during, created_at, updated_at)
       SELECT user_id, title, $1::bigint, int4range($2::integer, $2::integer + 60, '[)'), $3, $3
       FROM appointtypes
       WHERE id = $4 AND user_id = $5
       RETURNING id`,
      [body.date, body.start_min, now, body.typeId, userId],
    )

    if (result.rows.length === 0) {
      return Response.json(
        { error: 'Appointment type not found or access denied.' },
        { status: 404 },
      )
    }

    return Response.json({ id: result.rows[0].id }, { status: 201 })
  }

  // BRANCH B: no typeId → normal creation (with title, validation, lifecycle hooks)
  let parsed = s.parseSafe(createSchema, body)
  // ...createAppointment(db, userId, parsed.value)...
}
```

---

## Why INSERT…SELECT Instead of Two Queries

A naive approach would be:

1. `SELECT title, user_id FROM appointtypes WHERE id = $1 AND user_id = $2`
2. `INSERT INTO appointments (user_id, title, ...) VALUES ($1, $2, ...)`

This has a **race condition** — between the SELECT and the INSERT, another session could delete or change the type. The INSERT...SELECT is atomic: it either succeeds with the current data or finds no matching row and inserts zero rows.

---

## Security: The `user_id = $5` Guard

The most critical part of the query is the `AND user_id = $5` in the WHERE clause:

```sql
FROM appointtypes
WHERE id = $4 AND user_id = $5
--              ^^^^^^^^^^^^^^ guards against cross-user type access
```

Without this, an authenticated user could craft a request with `typeId: 999` and create an appointment using another user's type title. The `userId` comes from the authenticated session (`auth.identity`), not from the request body.

**What happens if the type doesn't belong to the user?** The SELECT returns zero rows, the INSERT inserts zero rows, `result.rows.length === 0`, and we return 404.

---

## What INSERT…SELECT Bypasses

The `appointments` table has a `beforeWrite()` hook that sets `created_at` and `updated_at`:

```tsx
beforeWrite({ operation, value }) {
  let next = { ...value }
  if (operation === 'create') {
    let now = Date.now()
    if (next.created_at === undefined) next.created_at = now
    if (next.updated_at === undefined) next.updated_at = now
  }
  ...
}
```

Raw SQL bypasses this hook entirely. The `INSERT...SELECT` manually replicates the behavior:

```sql
$3::bigint  -- created_at (explicit timestamp)
$3          -- updated_at (same timestamp as created_at)
```

Both timestamp values come from a single `let now = Date.now()` in JavaScript. If the schema's `beforeWrite` hook changes (adding new default fields, changing timestamp logic), this raw SQL query must be updated to match.

> **⚠️ WARNING**: The source file contains a comment on line 130:
> ```
> // WARNING: This raw SQL bypasses appointments.beforeWrite() lifecycle hook.
> // Keep behavior in sync (timestamps, field defaults) if beforeWrite changes.
> ```

---

## Duration Default

The type has no duration field, so the end time is hardcoded in the `int4range()` constructor:

```sql
int4range($2::integer, $2::integer + 15, '[)')
--         ^start_min    ^end_min = start_min + 15 minutes (minimum duration)
```

If duration-per-type is added later, this constant `15` would need to become a column value in the `SELECT` clause.

---

## Validation Differences from Normal Creation

| Aspect | Normal (Branch B) | Type-Drag (Branch A) |
|--------|-------------------|----------------------|
| Title | Required, validated via schema | Copied from appointtypes (validated on type creation) |
| `end_min` | Required from request body | Auto-calculated: `start_min + 15` (minimum duration) |
| Range column | Set via `beforeWrite` from `start_min`/`end_min` | Set via `int4range()` constructor in SQL |
| ORM lifecycle | `beforeWrite()`, `validate()`, `afterRead()` | None — raw SQL |
| CSRF | Checked via middleware | Checked via middleware (same) |
| Ownership | `userId` from auth | `userId` from auth + `user_id` filter in SQL |

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/actions/appointment-controller.tsx` | 133–153 | INSERT...SELECT branch in `create` action |
| `app/actions/appointment-controller.tsx` | 131 | WARNING comment about `beforeWrite` bypass |
| `app/data/appointments.ts` | 44–61 | Normal `createAppointment()` with `beforeWrite` lifecycle |
| `app/data/schema.ts` | 286–376 | `appointments` table definition with `during` + computed columns |
| `app/lib/appointtype-drag.ts` | 1–15 | Shared drag state that carries `typeId` from panel to grid |
| `app/ui/appointment-grid.tsx` | 893–924 | Client-side: `onTypeDragEnd` sends POST with `typeId` |

## Related

- [AppointType Drag-to-Insert](./appointtype-drag-insert.md) — Client-side flow that triggers this server path
- [AppointType Inline CRUD](./appointtype-inline-crud.md) — Managing the types that feed the SELECT
- [PostgreSQL Range Types](../concepts/postgres-range-types.md) — `int4range` with `remix/data-table`
- [Computed Columns](../concepts/computed-columns.md) — Read-only GENERATED ALWAYS AS columns
- [Database Architecture](../concepts/database-architecture.md) — `beforeWrite`/`afterRead` lifecycle conventions
