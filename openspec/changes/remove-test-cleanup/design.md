## Context

The ephemeral test database change ensures every `npm test` invocation starts with a clean database. Before that change, tests had to manually delete data they created to prevent debris accumulating across runs. This created three dead patterns:

1. **Shared teardown utility** — `teardownTestEnvironment()` in `controller.test-utils.ts` deletes resources, offerings, and appointments
2. **Tracking arrays** — module-level arrays (`createdAppointmentIds`, `createdUserIds`, etc.) accumulate IDs for cleanup in `after()` hooks
3. **Preemptive cleanups** — `DELETE FROM ... WHERE id LIKE 'test-%'` at the start of tests to remove debris from aborted runs

All three patterns are now unnecessary and can be safely removed.

## Goals / Non-Goals

**Goals:**
- Remove all test cleanup code that only existed for cross-run debris management
- Leave within-test setup code untouched (tests still create their data)
- Reduce cognitive load when reading test files

**Non-Goals:**
- No restructuring or refactoring of test logic
- No removal of `before()` setup code (tests still need test data)
- No removal of within-run collision avoidance (e.g., `nextSlot()` in appointments-create tests)

## Decisions

**Decision: Remove, don't abstract**

The cleanup code follows no unified pattern — some use `pool.query`, others use `db.exec(sql`...``). Rather than standardizing, simply delete it all. The code is dead, not inconsistent.

**Decision: Keep `setupTestEnvironment()` as-is**

The setup function creates resources, offerings, and sessions. Tests still need these. Only its `teardownTestEnvironment()` counterpart is removed. The setup's `initializeAppDatabase()` call is also retained — it's a no-op after the first call per worker due to the module-level promise, so removing it would save only the function call overhead but risk confusion.

## Risks / Trade-offs

- [Low] A test accidentally depends on an `after()` cleanup running before the next test — unlikely since cleanup only deletes test-specific data and within a fresh DB nothing persists across runs anyway
- [Low] Removing a tracking array misses a test that references it — caught by typecheck/compilation since the variable is `const` and used in both test body and `after()`
