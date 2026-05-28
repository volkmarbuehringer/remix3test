## Context

The appointments calendar in newapp uses a PostgreSQL `appointments` table with `start_min` (integer, minute of day) and `end_min` (integer) columns. Currently, overlap prevention is handled client-side in `schedule-layout.ts` via a layout solver. There is no database-level enforcement of non-overlapping time ranges.

PostgreSQL offers `int4range` — a built-in range type for integer ranges — with GiST-indexable overlap operators (`&&`). By using a range column with a `GENERATED ALWAYS AS ... STORED` computed column pattern, we can compute `start_min` and `end_min` from the range automatically. This keeps the existing API contract (clients send/receive `start_min`/`end_min`) while adding database-level overlap enforcement.

Current state:
- Table uses `start_min INTEGER NOT NULL, end_min INTEGER NOT NULL` as storage columns
- No exclusion constraint for overlap prevention
- Schema's `beforeWrite` handles timestamp defaults
- Raw SQL bypass exists in `appointment-controller.tsx` for type-drag creation
- No production data exists (early development)

## Goals / Non-Goals

**Goals:**
- Add `during int4range NOT NULL` as the primary storage column
- Make `start_min` and `end_min` computed from `during` via `GENERATED ALWAYS AS (lower/upper(during)) STORED`
- Add `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (during WITH &&)` to prevent overlapping ranges
- Update `beforeWrite` in schema.ts to convert `start_min`/`end_min` input into `during` range
- Update raw SQL INSERT in controller to use `int4range()` constructor
- All existing data access patterns (`db.create`, `db.update`, `db.query`) remain functional
- All existing tests pass without modification to test assertions

**Non-Goals:**
- No changes to the API contract — request/response payloads still use `start_min`/`end_min`
- No changes to the UI or client-side layout solver (`schedule-layout.ts` unchanged)
- No changes to how appointments are queried (SELECT, filtering by week/date)
- No production data migration — development DB can be recreated

## Decisions

### Decision 1: Use `int4range` with half-open `[)` notation

- **Chosen**: `int4range` with `[start_min, end_min)` — half-open interval where start is included and end is excluded. This matches the existing convention where `end_min` is exclusive (a 60-minute block from 480 to 540 means 480 ≤ minute < 540).
- **Alternatives considered**:
  - `numrange`: Floating point, not appropriate since minutes are always integers.
  - `tsrange`/`tstzrange`: Timestamp ranges — more powerful but would require changing how `date` and minutes are combined. Overkill for minute-of-day tracking.
  - Raw `start_min`/`end_min` without range type: No exclusion constraint support.
- **Rationale**: `int4range` is the natural fit for integer minute ranges. [)` matches the existing exclusive-end convention exactly.

### Decision 2: Computed columns via `GENERATED ALWAYS AS ... STORED`

- **Chosen**: Define `start_min` and `end_min` as `GENERATED ALWAYS AS lower(during) STORED` and `GENERATED ALWAYS AS upper(during) STORED`, placed as the last two columns in the table.
- **Alternatives considered**:
  - Virtual computed columns (`GENERATED ALWAYS AS ... VIRTUAL`): Not supported in PostgreSQL.
  - Views: Would require changing query patterns throughout the codebase.
  - Write `start_min`/`end_min` independently alongside `during`: Duplication risk, no single source of truth.
- **Rationale**: Stored computed columns are computed by PostgreSQL on write, occupy no space beyond the range column (well, minimal index space), and make `SELECT *` return `start_min`/`end_min` as regular integer columns — zero application changes for reads.

### Decision 3: Handle conversion in schema's `beforeWrite` lifecycle

- **Chosen**: The `appointments` table's `beforeWrite` hook strips `start_min`/`end_min` from the write payload and adds `during` as a text range string (e.g., `[480,540)`).
- **Alternatives considered**:
  - Modify `appointments.ts` data layer to construct `during` directly: Duplicates the conversion logic. The `beforeWrite` lifecycle is the centralized place for this transformation.
  - Modify `db.create`/`db.update` in the data-table library: Too invasive, framework-level change.
- **Rationale**: `beforeWrite` is already used for timestamp defaults. Adding range conversion here keeps the conversion centralized, testable, and consistent across both the ORM and any future code paths.

### Decision 4: Exclusion constraint with user_id and date scope

- **Chosen**: Include `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (date WITH =, during WITH &&)` — scoped to same day regardless of user. Prevents double booking entirely. Requires the `btree_gist` extension for `=` operators on GiST.
- **Alternatives considered**:
  - `(user_id WITH =, date WITH =, during WITH &&)`: Per-user scoping — allows different users to book the same time slot, enabling double booking.
  - `during WITH &&` alone: Too broad — prevents overlaps across different days.
  - `ALTER TABLE` after creation: Works but requires a DO block for `IF NOT EXISTS` compatibility. Inline in CREATE TABLE is cleaner.
  - Separate migration script: Over-engineered for early development.
- **Rationale**: No double booking means no two appointments can overlap on the same day, regardless of who created them. This is a global calendar constraint. The `btree_gist` extension is widely available and adds minimal overhead.

## Risks / Trade-offs

- **[Migration] Existing rows in the appointments table** (if any) would lack a `during` column after schema changes. Since this is early development without production data, the `CREATE TABLE IF NOT EXISTS` approach combined with a fresh database seed (or manual `DROP TABLE appointments` + restart) is acceptable.
- **[Raw SQL bypass] The type-drag path** in `appointment-controller.tsx` uses raw SQL and bypasses the schema's `beforeWrite` lifecycle. This means we must update both the SQL AND the controller's raw query, keeping them in sync with the lifecycle logic (timestamps, range construction). A `beforeWrite` level comment already warns about this.
- **[PostgreSQL version] `int4range` and GiST exclusion constraints with `btree_gist`** require PostgreSQL 9.2+. The project uses a recent version, so this is not a concern.
