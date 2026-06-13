---
name: test-cleanup-pagination-parallel-interference
description: "Ephemeral test DBs don't eliminate within-run parallel pagination interference"
user-invocable: false
origin: auto-extracted
---

# Parallel test interference via paginated views

**Extracted:** 2026-06-12
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

1. **Diagnose by isolation:** Run the failing test file alone — if it passes, interference is the likely cause
2. **Count the data sources:** seed data + test helper data + test's own data + parallel workers' data ≤ page size?
3. **Fix options:**
   - **Keep cleanup for colliding data sources** — retain `after()` hooks only for tests that share paginated views
   - **Increase page size in test environment** — raise the limit so parallel data can't push past it
   - **Use unique filters** — scope assertions to specific identifiers instead of scanning the full page

## When to Use

- Removing test cleanup code after ephemeral database implementation
- Debugging a test that passes in isolation but fails in parallel suite
- Investigating whether pagination page sizes interact with parallel test data volume
