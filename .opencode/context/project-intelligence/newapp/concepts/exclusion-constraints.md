<!-- Context: project-intelligence/newapp/concepts/exclusion-constraints | Priority: high | Version: 1.1 | Updated: 2026-05-25 -->

# Concept: Exclusion Constraints with `btree_gist`

**Core Idea**: PostgreSQL exclusion constraints (`EXCLUDE USING GIST`) prevent rows from having conflicting values across multiple columns. Unlike `UNIQUE` constraints (exact match), exclusion constraints support range overlap (`&&`), adjacency (`-|-`), and containment (`@>`) operators.

---

## Setup: `btree_gist` Extension

The `btree_gist` extension enables GiST indexes on scalar types (integer, bigint, timestamp) so they can be mixed with range operators in a single exclusion constraint:

```tsx
// app/data/setup.ts — added with other extensions
await pool.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
```

Without `btree_gist`, GiST indexes only work on range/geometry types. With it, `user_id WITH =` (integer equality) and `during WITH &&` (range overlap) can participate in the same constraint.

---

## The Pattern: Scoped Overlap Prevention

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- ...other columns...
  during int4range NOT NULL,
  CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
    user_id WITH =,    -- same user
    date WITH =,       -- same day
    during WITH &&     -- overlapping time range
  )
)
```

This means:
- **Same user** (`user_id WITH =`): only applies within one user's appointments
- **Same day** (`date WITH =`): only applies within the same day
- **Overlapping range** (`during WITH &&`): the time ranges cannot intersect

A user can have appointments at 10:00-11:00 on Monday AND 10:00-11:00 on Tuesday (different days). But they cannot have 10:00-11:00 AND 10:30-11:30 on the same Monday.

---

## Variant: Resource-Scoped Overlap (`appointoffering`)

The `appointoffering` table uses the same pattern but scoped to **resource** instead of **user**:

```sql
CREATE TABLE IF NOT EXISTS appointoffering (
  id SERIAL PRIMARY KEY,
  day BIGINT NOT NULL,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  during int4range NOT NULL,
  -- ...timestamps...
  CONSTRAINT no_overlapping_offerings EXCLUDE USING GIST (
    resource_id WITH =,   -- same resource
    day WITH =,           -- same day
    during WITH &&        -- overlapping time range
  )
)
```

This means:
- **Same resource** (`resource_id WITH =`): only applies within one resource's offerings
- **Same day** (`day WITH =`): only applies within the same day
- **Overlapping range** (`during WITH &&`): the time ranges cannot intersect

A resource can have 8:00–12:00 AND 13:00–18:00 on the same day (adjacent ranges don't overlap), but not 8:00–12:00 AND 10:00–14:00 (overlap).

**Key difference from appointments**: Offerings scope by `resource_id` (not `user_id`) since availability is resource-relative, not user-relative. Appointments later validate against offerings by resource + day.

---

## Migration for Existing Tables

When adding an exclusion constraint to an existing table, use a DO block:

```sql
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'start_min'
    AND is_generated = 'NEVER'
  ) THEN
    -- Add the range column, populate, then add constraint
    ALTER TABLE appointments ADD COLUMN during int4range;
    UPDATE appointments SET during = int4range(start_min, end_min, '[)');
    ALTER TABLE appointments ALTER COLUMN during SET NOT NULL;
    ALTER TABLE appointments DROP COLUMN start_min, DROP COLUMN end_min;
    ALTER TABLE appointments ADD COLUMN start_min INTEGER GENERATED ALWAYS AS (lower(during)) STORED;
    ALTER TABLE appointments ADD COLUMN end_min INTEGER GENERATED ALWAYS AS (upper(during)) STORED;
    ALTER TABLE appointments ADD CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
      user_id WITH =, date WITH =, during WITH &&
    );
  END IF;
END $$;
```

The `IF EXISTS` check ensures idempotency — the block only runs if the table still has the legacy columns.

---

## Error Handling

When the exclusion constraint is violated, PostgreSQL throws:

```
ERROR:  conflicting key value violates exclusion constraint "no_overlapping_seats"
DETAIL:  Key (user_id, date, during)=(1, 1893456000000, [480,540)) conflicts with existing key (user_id, date, during)=(1, 1893456000000, [480,540)).
```

The ORM's `validate()` hook catches obvious issues (start_min >= end_min, out of bounds) but cannot detect overlap without a query. The exclusion constraint is the **last line of defense** at the database level.

---

## Test Isolation

Each integration test that creates appointments uses unique time slots to avoid exclusion constraint conflicts:

```tsx
// Each test uses different minutes:
start_min: 480,   // test A
start_min: 540,   // test B
start_min: 600,   // test C
// ...
```

The `after` hook uses `after` (not `afterEach`), meaning all test cleanup runs once at the end. If two tests tried to create an appointment at the same time for the same user+date, one would fail with the exclusion constraint error.

**Rule of thumb for tests**: Use unique `start_min` for every test that creates an appointment. Sequential tests can use `480, 540, 600, 660, ...` to guarantee no overlap.

---

## 📂 Codebase References

| File | Lines | What |
|------|-------|------|
| `app/data/setup.ts` | 101 | `CREATE EXTENSION IF NOT EXISTS btree_gist` |
| `app/data/setup.ts` | 114-131 | Appointments: `no_overlapping_seats` constraint |
| `app/data/setup.ts` | 156-169 | AppointOfferings: `no_overlapping_offerings` constraint |
| `app/data/setup.ts` | 135-155 | Migration DO block for existing tables |
| `app/ui/appointment-grid.test.ts` | 688-710 | Test using unique time slots per test |

## Related

- [PostgreSQL Range Types](./postgres-range-types.md) — `int4range` column representation
- [Computed Columns](./computed-columns.md) — GENERATED ALWAYS AS columns
- [Appointment CRUD Guide](../guides/appointment-crud.md) — Data layer operations
- [AppointOffering Concept](./appointoffering.md) — Resource availability architecture
- [AppointOffering CRUD Guide](../guides/appointoffering-crud.md) — Data access functions
- [Database Architecture](./database-architecture.md) — Table overview
- [Test Patterns](../../development/remix3/concepts/test-patterns.md) — Integration test setup
