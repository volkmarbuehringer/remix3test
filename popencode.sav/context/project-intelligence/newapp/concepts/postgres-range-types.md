<!-- Context: project-intelligence/newapp/concepts/postgres-range-types | Priority: high | Version: 1.0 | Updated: 2026-05-24 -->

# Concept: PostgreSQL Range Types with `remix/data-table`

**Core Idea**: Model PostgreSQL `int4range` (or `int8range`, `tsrange`, `daterange`) columns as `c.text()` in the schema. Use `beforeWrite` to convert integer pair to range string, and `afterRead` to normalize the driver's object return type back to string.

---

## The Problem

PostgreSQL range types (like `int4range`) are not directly supported by `remix/data-table` column types. The `pg` driver returns them as objects (`{ lower: number, upper: number }`), but the ORM expects plain values.

---

## The Solution: Three-Layer Conversion

```
Client sends { start_min: 480, end_min: 540 }
  │
  ▼
beforeWrite: converts to "[480,540)"  ← stored in during column
  │
  ▼
PostgreSQL stores as int4range [480,540)
  │  (computed columns: start_min=480, end_min=540)
  ▼
afterRead: normalizes driver's {lower, upper} object → "[480,540)" string
```

### 1. Column Definition (`c.text()`)

```tsx
columns: {
  during: c.text(),           // maps to int4range — stored as string like "[480,540)"
  start_min: c.integer(),     // GENERATED ALWAYS AS (lower(during)) STORED — read-only
  end_min: c.integer(),       // GENERATED ALWAYS AS (upper(during)) STORED — read-only
}
```

Even though the SQL column is `int4range`, `c.text()` works because `beforeWrite` provides a string, and `afterRead` converts the driver's object back to string.

### 2. `beforeWrite` — Convert Pair to Range String

```tsx
beforeWrite({ operation, value }) {
  let next = { ...value }

  // Convert start_min/end_min to during range string
  if (next.start_min !== undefined && next.end_min !== undefined) {
    next.during = `[${next.start_min},${next.end_min})`  // e.g. "[480,540)"
  }

  // Strip computed columns — can't write to GENERATED ALWAYS columns
  delete next.start_min
  delete next.end_min

  return { value: next }
}
```

**Key**: The range string format `[start,end)` matches PostgreSQL's `int4range` text input format. The square bracket `[` means inclusive lower bound, `)` means exclusive upper bound.

### 3. `afterRead` — Normalize Driver Return Type

```tsx
afterRead({ value }) {
  // during is int4range — normalize to string if driver returns it as object
  if (typeof value.during === 'object' && value.during !== null) {
    let r = value.during as { lower: unknown; upper: unknown }
    value.during = `[${r.lower},${r.upper})`
  }
  // start_min and end_min are computed — they return as integers directly
  return { value }
}
```

---

## Raw SQL: Use `int4range()` Constructor

When writing raw SQL (bypassing the ORM lifecycle), use the `int4range()` function:

```sql
INSERT INTO appointments (user_id, title, date, during, created_at, updated_at)
VALUES ($1, $2, $3::bigint, int4range($4::integer, $5::integer, '[)'), $6, $6)
```

The third argument `'[)'` specifies the bound type (inclusive lower, exclusive upper — the default and most common for time ranges).

---

## Querying Range Columns

PostgreSQL range operators work on `int4range` columns even though the ORM sees them as text:

```sql
-- Overlap check (&&): does range A overlap with range B?
SELECT * FROM appointments WHERE during && int4range(480, 540, '[)')

-- Contains (@>): does range contain value?
SELECT * FROM appointments WHERE during @> 500

-- Contained by (<@): is range inside another range?
SELECT * FROM appointments WHERE during <@ int4range(0, 1440, '[)')
```

The exclusion constraint `during WITH &&` uses the overlap operator — it prevents two rows with the same `user_id` and `date` from having overlapping `during` ranges.

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/data/schema.ts` | 296 | `during: c.text()` column definition |
| `app/data/schema.ts` | 297-298 | Computed `start_min`/`end_min` columns |
| `app/data/schema.ts` | 341-363 | `beforeWrite` — range conversion + stripping |
| `app/data/schema.ts` | 364-375 | `afterRead` — normalize int4range object → string |
| `app/data/setup.ts` | 122-124 | `during int4range NOT NULL` in CREATE TABLE |
| `app/data/setup.ts` | 136-155 | Migration DO block for existing data |
| `app/actions/appointment-controller.tsx` | 140 | Raw SQL using `int4range()` constructor |

## Related

- [Computed Columns](./computed-columns.md) — GENERATED ALWAYS AS columns as read-only fields
- [Exclusion Constraints](./exclusion-constraints.md) — `btree_gist` + `EXCLUDE USING GIST` for overlap prevention
- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer using range types
- [AppointType INSERT…SELECT](../guides/appointtype-insert-select.md) — Raw SQL with `int4range()`
