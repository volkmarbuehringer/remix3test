<!-- Context: project-intelligence/newapp/concepts/computed-columns | Priority: high | Version: 1.0 | Updated: 2026-05-24 -->

# Concept: Computed Columns as Read-Only Fields

**Core Idea**: PostgreSQL `GENERATED ALWAYS AS (expression) STORED` columns are read-only — you can SELECT them but not INSERT or UPDATE them. Keep them in the `remix/data-table` schema for query readability, but strip them from write payloads in `beforeWrite`.

---

## The Pattern

```sql
CREATE TABLE appointments (
  -- ...other columns...
  during int4range NOT NULL,
  start_min INTEGER GENERATED ALWAYS AS (lower(during)) STORED,  -- read-only
  end_min   INTEGER GENERATED ALWAYS AS (upper(during)) STORED   -- read-only
);
```

`start_min` and `end_min` are always derived from `during`. They are not stored independently — PostgreSQL computes them on read.

---

## Schema Definition — Keep for SELECT

Include computed columns in the schema so queries return them naturally:

```tsx
columns: {
  during: c.text(),           // writable — stores the range
  start_min: c.integer(),     // GENERATED ALWAYS — read-only in DB
  end_min: c.integer(),       // GENERATED ALWAYS — read-only in DB
}
```

This means `SELECT *` from the ORM returns `start_min` and `end_min` as integers alongside `during` as a string. Controllers and UI code can read them directly without extra computation.

---

## `beforeWrite` — Strip for INSERT/UPDATE

PostgreSQL rejects writes to GENERATED ALWAYS columns with:

```
ERROR:  column "start_min" is a generated column
DETAIL:  Generated columns cannot be used in INSERT or UPDATE.
```

The `beforeWrite` hook removes both computed columns before any write operation:

```tsx
beforeWrite({ operation, value }) {
  let next = { ...value }

  // Convert start_min/end_min to during range string
  if (next.start_min !== undefined && next.end_min !== undefined) {
    next.during = `[${next.start_min},${next.end_min})`
  }

  // Strip computed columns — they are GENERATED ALWAYS, cannot be written
  delete next.start_min
  delete next.end_min

  // ...default timestamps...

  return { value: next }
}
```

**Order matters**: Convert `start_min`/`end_min` to the `during` range string *before* stripping them.

---

## `afterRead` — Normalize Driver Types

Computed columns from `int4range` return as plain integers from PostgreSQL (the driver handles them like any scalar column). No special handling needed for the computed columns themselves — only the underlying `during` range column needs normalization:

```tsx
afterRead({ value }) {
  // during is int4range — normalize driver object to string
  if (typeof value.during === 'object' && value.during !== null) {
    let r = value.during as { lower: unknown; upper: unknown }
    value.during = `[${r.lower},${r.upper})`
  }
  // start_min and end_min return as plain integers — no conversion needed
  return { value }
}
```

---

## Benefits Over Separate Columns

| Aspect | Separate `start_min`/`end_min` | Computed columns from `int4range` |
|--------|-------------------------------|-----------------------------------|
| Data integrity | App-level validation only | Database-enforced (range type) |
| Overlap detection | Needs app code | `EXCLUDE USING GIST` at DB level |
| Query readability | Same | Same (computed columns are visible) |
| Write complexity | Direct column writes | Must convert to range in `beforeWrite` |
| Migration | Trivial | DO block + backfill needed |

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/data/schema.ts` | 286-376 | Full appointments table with computed columns |
| `app/data/schema.ts` | 346-350 | `beforeWrite` strips computed columns |
| `app/data/setup.ts` | 123-124 | SQL: `GENERATED ALWAYS AS (lower/upper(during)) STORED` |
| `app/data/setup.ts` | 138-154 | Migration DO block for existing data |

## Related

- [PostgreSQL Range Types](./postgres-range-types.md) — Underlying `int4range` column
- [Exclusion Constraints](./exclusion-constraints.md) — Overlap prevention with GiST
- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer using computed columns
- [Database Architecture](../concepts/database-architecture.md) — Schema lifecycle conventions
