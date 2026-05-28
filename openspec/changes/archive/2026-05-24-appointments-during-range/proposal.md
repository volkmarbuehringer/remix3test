## Why

The appointments table currently stores `start_min` and `end_min` as independent columns with no database-level enforcement of non-overlapping time ranges. By introducing a PostgreSQL `int4range` column (`during`) with computed columns and an exclusion constraint, we gain automatic overlap prevention at the database level while keeping the existing API contract (`start_min`/`end_min` in requests/responses) unchanged.

## What Changes

- **setup.ts**: Add `CREATE EXTENSION IF NOT EXISTS btree_gist`; update `CREATE TABLE IF NOT EXISTS appointments` to use `during int4range NOT NULL` with `start_min` and `end_min` as `GENERATED ALWAYS AS lower/upper(during) STORED` computed columns (placed as the last two columns), plus a `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (date WITH =, during WITH &&)` exclusion constraint preventing double booking (same day, any user)
- **schema.ts**: Update the `appointments` table definition to include `during` column and convert `start_min`/`end_min` to the range value in `beforeWrite`, while preserving all existing lifecycle behavior (timestamps, afterRead conversions)
- **appointments.ts**: Adjust data layer so `createAppointment` and `updateAppointment` write `during` instead of raw `start_min`/`end_min` columns
- **appointment-controller.tsx**: Update the raw SQL INSERT (type-drag path) to use `int4range()` function instead of `start_min`/`end_min` columns
- **API contract is unchanged** — clients still send/receive `start_min` and `end_min`
- **SELECT is compatible** — computed columns return `start_min`/`end_min` as integers automatically

## Capabilities

### New Capabilities

- _(none — this is an implementation change, no new feature capability)_

### Modified Capabilities

- `appointment-calendar`: The `appointments` table schema now uses `during int4range` with computed `start_min`/`end_min` columns and an exclusion constraint for overlap prevention. The API contract and query interface remain the same.

## Impact

- **`app/data/setup.ts`**: CREATE TABLE updated with new column structure and constraint
- **`app/data/schema.ts`**: `appointments` table definition updated — `during` column added, `beforeWrite` converts `start_min`/`end_min` to range
- **`app/data/appointments.ts`**: Data layer write paths use `during` internally
- **`app/actions/appointment-controller.tsx`**: Raw SQL INSERT in type-drag path updated to use `int4range()`
- **Database**: Existing rows (if any) need migration — but since this is early development and no production data exists, a fresh table recreation (`CREATE TABLE IF NOT EXISTS` with the new structure) is sufficient
