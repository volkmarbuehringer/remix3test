<!-- Context: project-intelligence/newapp/errors/admin-nutzer-fk-test | Priority: medium | Version: 1.0 | Updated: 2026-05-26 -->

# Error: Admin-Nutzer FK Test Failure

**Severity**: 🟡 Medium

**File**: `app/actions/admin-nutzer-controller.test.tsx`

A pre-existing FK constraint (nutzer → login) causes one test failure when test data from a previous run wasn't fully cleaned up, or other test data references the same login rows.

**Symptom**: One test fails with FK violation when deleting a `login` row still referenced by a `nutzer` row.

**Fix**:
1. Ensure cleanup in FK order (nutzer first, then login)
2. Wrap cleanup in try/catch for interrupted runs
3. Use unique-per-run test data identifiers (already done with `Date.now()` prefixes)
