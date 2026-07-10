## Why

Tests share the same PostgreSQL database (`newapp`) as development. Over 2500 orphaned user rows have accumulated. Test debris pollutes dev data, parallel workers collide on email uniqueness constraints, and cleanup failures leave stale rows that interfere with subsequent runs. A fresh database per test run eliminates accumulation entirely and provides a deterministic starting state.

## What Changes

- `test/setup.ts` — `globalSetup()` creates a unique temp database (e.g. `newapp_test_<timestamp>_<pid>`), runs migration + seed, sets `DATABASE_URL` to point at it
- `test/setup.ts` — `globalTeardown()` drops the temp database after all workers complete
- `app/data/seed.ts` — no changes needed; idempotent guards become unnecessary but harmless
- No test files need modification — `initializeAppDatabase()` in `app/data/setup.ts` is already deduplicated via a module-level promise

## Capabilities

### New Capabilities

- `test-database-isolation`: Ephemeral PostgreSQL database creation, migration, seeding, and teardown per test run. Ensures each `remix test` invocation starts with a clean schema and seed data, with no cross-run accumulation.

### Modified Capabilities

None. No application behavior changes.

## Impact

- `test/setup.ts` — adds `pg` import for admin pool, temp DB creation/drop logic
- Build time — adds ~1-2s per test run for migration + seed
- Postgres — requires `CREATEDB` privilege (already available as `postgres` superuser)
- Orphan cleanup — temp databases persist if process is SIGKILLed; mitigation via named pattern for manual cleanup
