# Parallel test interference via paginated views

**Source:** `remix-test-parallel-interference`

**Extracted:** 2026-06-12
**Updated:** 2026-09-22 — added the unscoped-`afterEach`-wipe failure mode; 2026-09-12 added the "fails in isolation too" fixture-determinism caveat.
**Context:** Removing dead test cleanup code after implementing ephemeral databases per test run. Some cleanup was still needed because parallel workers' data pushed assertions past a pagination page boundary.

## Problem

After switching to ephemeral databases per test run, removing all `after()` cleanup hooks caused a test to fail intermittently in the full test suite (but always pass in isolation). The test created offerings and checked they appeared on a paginated page. With `OFFERINGS_PAGE_SIZE=12`, data from parallel test workers' setups pushed the test's own data past the page limit.

Root cause: data created by parallel workers' `setupTestEnvironment()` calls accumulates in the shared ephemeral DB. When the total exceeds the page size, the test's assertion fails because its data isn't displayed on the first page.

```
Seed offerings:      5
Test helper setups:  5 (one per parallel test file)
Test-specific data:  2
                    ───
Total:              12  ← exactly at OFFERINGS_PAGE_SIZE boundary
```

## Solution

When removing test cleanup code after implementing ephemeral databases, verify each test file's assertions aren't sensitive to the total data volume on paginated pages:

1. **Diagnose by isolation:** Run the failing test file alone — if it passes, interference is the likely cause (but see the caveat below if it fails alone too)
2. **Count the data sources:** seed data + test helper data + test's own data + parallel workers' data ≤ page size?
3. **Fix options:**
   - **Keep cleanup for colliding data sources** — retain `after()` hooks only for tests that share paginated views
   - **Increase page size in test environment** — raise the limit so parallel data can't push past it
   - **Use unique filters** — scope assertions to specific identifiers instead of scanning the full page

### Caveat: a shared-DB test can fail in isolation too

Passing in isolation is a strong interference signal, not the only cause of a shared-DB flake. If it fails alone, suspect a fixture that is not self-owned:

- **Unordered `LIMIT 1`** — `SELECT id FROM resources LIMIT 1` (no `ORDER BY`) picks an arbitrary row from a DB other suites have written to, so the picked row may not satisfy what the test asserts about it. Pick deterministically (`ORDER BY id`) and require the properties the test needs in the query (`JOIN … WHERE …`).
- **Seed rows are relative to today** — a filter test that relies on seeded weekday offerings (`Mon–Fri 8:00–18:00`) fails on weekends, once the default `day >= today` status window excludes every seeded row.

Fix by making the fixture self-owned: create the rows the assertion depends on and scope the assertion to identifiers the test owns (`rows.some(r => r.id === testId)`) instead of `rows.length >= 1` over a shared table. In the source case the pick became `JOIN offering_configs … ORDER BY r.id LIMIT 1` with an explicit throw when empty, and the filter test creates its own offering and filters by that resource's actual name.

### An unscoped `afterEach` wipe deletes a parallel suite's live fixture

**Observed:** 2026-09-22 — `chat/gate-store.test.ts` "resolves a suspended question gate for a live run" failed once in a full run (`assert.ok(gate, 'suspended gate should resolve')`) and passed in isolation and in the next three full runs.

`chat/controller.test.ts`'s `afterEach` ran `DELETE FROM chat_runs` / `DELETE FROM chat_pending_gates` with no predicate. `gate-store.test.ts` and `run-store.test.ts` create their own fixture users and depend on their just-inserted `chat_runs` row surviving — `resolvePendingGate()` joins it (`JOIN chat_runs r ON r.run_id = g.run_id AND r.user_id = g.user_id`), so any overlap between the controller suite's teardown and their insert→assert window silently nulls the gate. `pool: 'forks'` isolates processes, not the shared database.

**Rule:** a test cleanup may only delete rows its own fixtures own. Resolve the ids the suite authenticates as once in `before()` and scope every delete to them:

```ts
suiteUserIds = (
  await Promise.all([getUserId('admin@newapp.com'), getUserId('user@newapp.com')])
).filter((id) => Number.isInteger(id))
// afterEach
await pool.query('DELETE FROM chat_runs WHERE user_id = ANY($1::int[])' , [suiteUserIds])
```

Keep the suite's own isolation (leftover rows still block the next test) without reaching into tables other suites own. Grep for the pattern when a shared-table test flakes: `grep -rn "DELETE FROM <table>'" app/` with no `WHERE` is the tell — unscoped deletes are the only cleanup that can cross suites.

## When to Use

- Removing test cleanup code after ephemeral database implementation
- Debugging a test that passes in isolation but fails in parallel suite
- Investigating whether pagination page sizes interact with parallel test data volume
- A shared-DB test that fails even in isolation — check for an unordered `LIMIT 1` pick or seed data whose relevance depends on today's date
