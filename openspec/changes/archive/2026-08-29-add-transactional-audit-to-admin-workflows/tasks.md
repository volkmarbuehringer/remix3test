# Tasks: Transactional Audit for Admin Workflows

## 1. Strict audit write path

- [x] 1.1 Add `logAdminActionStrict(db, entry)` to `app/data/audit-log.ts` — same INSERT as `logAdminAction`, no `try/catch` — and verify `npm run typecheck` passes
- [x] 1.2 Add a unit test in `app/data/audit-log.test.ts` asserting `logAdminActionStrict` inserts an entry AND propagates (rejects on) a db failure — verify with `npm test`

## 2. Workflow changes

- [x] 2.1 `cancel-user-workflow.ts`: move the audit write into the existing `db.transaction` of `delete-and-disable-account` using `logAdminActionStrict(tx, ...)` on the success path; stop the separate `audit-log` step from writing (remove the step if output plumbing allows) and derive `auditLogged` from success — verify existing `workflows.test.ts` cancel tests still pass
- [x] 2.2 `lock-user-workflow.ts`: wrap UPDATE + `logAdminActionStrict(tx, ...)` in one `db.transaction`; keep the `affectedRows === 0` no-op path outside the transaction with no audit entry — verify lock tests pass
- [x] 2.3 `unlock-user-workflow.ts`: same pattern as 2.2 with the `alreadyUnlocked` no-op skip preserved — verify unlock tests pass
- [x] 2.4 `delete-user-appointments.ts`: wrap DELETE + `logAdminActionStrict(tx, ...)` in one `db.transaction` inside `executeStep`; remove `finalize`'s audit write and derive `auditLogged` from success — verify delete-appointments tests pass

## 3. Atomicity tests

- [x] 3.1 Add a rollback test: force the strict audit write to fail (e.g. stub `logAdminActionStrict` or induce a constraint failure) and assert the mutation is NOT visible in the database and the workflow reports failure — for at least one representative workflow (cancel-user), verify with `npm test`
- [x] 3.2 Add/confirm assertions for the no-state-change paths: lock on already-locked user and unlock on already-unlocked user succeed with NO audit entry written — verify with `npm test`
- [x] 3.3 Update any tests asserting the old swallow behavior (`auditLogged: false` after audit failure, action still succeeding) to the strict behavior — verify full `npm test` is green

## 4. Verification

- [x] 4.1 Run `npm run typecheck` and `npm run lint` — both pass
- [x] 4.2 Run `npm test` end-to-end — full suite green including the new atomicity tests
