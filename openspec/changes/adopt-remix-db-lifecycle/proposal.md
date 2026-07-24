# Adopt Remix database lifecycle APIs

## Problem

`app/data/migrate.ts` contains 402 lines of imperative SQL with advisory locks,
`information_schema` introspection, and `DO $$ BEGIN` blocks — all replaced by
upstream `data-table` lifecycle APIs (`db.migrate()`, `db.wipe()`, `db.reset()`).

## Scope

- Replace `app/data/migrate.ts` with a single `db/migrations/` SQL migration file
- Switch `connection.ts` to pass config to adapter (so `wipe()` can manage the pool)
- Consolidate `seed.ts` into a proper `Seed` function
- Simplify `test/setup.ts` to use `db.reset()`
- Minor cleanups: `pool.query()` → `db.exec()`

## Non-goals

- No existing data migration — clean slate only
- No multi-file migration splitting (single migration file for all tables)
