## Why

The ephemeral test database change now gives every test run a clean database. All the `after()` teardown blocks, tracking arrays, ID cleanup lists, and the shared `teardownTestEnvironment()` utility are dead code — they exist solely to prevent cross-run debris, which is now impossible. ~200 lines of noise that every test author must read through and maintain.

## What Changes

All changes are deletions:
- Remove `teardownTestEnvironment()` from `app/actions/verwaltung/controller.test-utils.ts`
- Remove all `after()` cleanup blocks across ~13 test files
- Remove tracking arrays (`createdAppointmentIds`, `createdUserIds`, etc.) from test files
- Remove preemptive `DELETE FROM ... WHERE id LIKE 'test-%'` cleanup queries
- Remove silent `catch { /* ignore cleanup errors */ }` noise

## Capabilities

### New Capabilities
None. This is pure deletion of dead code — no new capabilities.

### Modified Capabilities
None. No spec-level behavior changes.

## Impact

- `app/actions/verwaltung/controller.test-utils.ts` — remove `teardownTestEnvironment()` (~19 lines)
- ~13 test files — remove `after()` blocks, tracking arrays, and preemptive cleanups (~180 lines total)
- No behavioral impact — all removed code was only needed for cross-run debris cleanup, which the ephemeral DB now guarantees never occurs
