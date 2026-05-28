## 1. Schema Definition

- [x] 1.1 Add `during` column to `appointments` table definition in `schema.ts` as `c.text()` for range serialization
- [x] 1.2 Update `beforeWrite` to convert `start_min`/`end_min` to `during` range string and strip computed columns from write payload
- [x] 1.3 Update `afterRead` to ensure computed `start_min`/`end_min` values are parsed correctly (they return as integers from computed columns)

## 2. Table Creation

- [x] 2.1 Update `CREATE TABLE IF NOT EXISTS appointments` in `setup.ts`: columns in order `id, user_id, title, date, created_at, updated_at, during int4range NOT NULL`, then `start_min INTEGER GENERATED ALWAYS AS lower(during) STORED` and `end_min INTEGER GENERATED ALWAYS AS upper(during) STORED` as last two columns
- [x] 2.2 Add `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (user_id WITH =, date WITH =, during WITH &&)` to the CREATE TABLE statement (requires `btree_gist` extension)

## 3. Data Layer

- [x] 3.1 Update `createAppointment` in `appointments.ts` — pass `during` instead of `start_min`/`end_min` (the schema's `beforeWrite` handles conversion)
- [x] 3.2 Update `updateAppointment` in `appointments.ts` — handle partial time updates by requiring both `start_min`/`end_min` together or neither

## 4. Controller

- [x] 4.1 Update raw SQL INSERT in `appointment-controller.tsx` (type-drag path, line ~138) to use `int4range($2::integer, $2::integer + 60, '[)')` instead of `start_min`/`end_min` columns

## 5. Validation

- [x] 5.1 Run `npm test` to verify all existing tests pass with the new column structure
- [x] 5.2 Run `npm run typecheck` to verify TypeScript types are consistent