# Proposal: Transactional Audit for Admin Workflows

## Why

The four destructive Mastra workflows (`cancelUserWorkflow`, `lockUserWorkflow`, `unlockUserWorkflow`, `deleteUserAppointmentsWorkflow`) write their audit-log entry in a separate step **after** the mutation commits. A process crash in the window between mutation commit and audit insert leaves a permanently missing audit entry for a real side effect (e.g. a cancelled account with no audit trail). This cannot be repaired by retrying: the validate step sees the mutation already applied (`disabled_at != null`) and early-returns, so all downstream steps — including the audit write — are skipped. The window is milliseconds wide but the consequence is compliance-adjacent and silent.

## What Changes

- Move the audit-log INSERT inside the same database transaction as the mutation for all four leaf workflows, so mutation and audit entry are all-or-nothing:
  - `cancel-user-workflow.ts`: audit write moves into the existing `db.transaction` block of the `delete-and-disable-account` step (the separate `audit-log` step's write is removed).
  - `lock-user-workflow.ts` / `unlock-user-workflow.ts`: the single UPDATE and the audit INSERT are wrapped in one transaction.
  - `delete-user-appointments.ts`: same pattern for its delete step.
- Preserve the existing no-state-change skip: when `affectedRows === 0` (`alreadyLocked` / `alreadyUnlocked`), no audit entry is written, as today.
- `userManagementWorkflow` requires no direct change — it delegates to the three leaf workflows via `executeActionStep`.
- **Open decision (resolved in design.md): audit-failure semantics.** Today audit failures are swallowed twice (workflow step catch + `logAdminAction`'s internal swallow), so the action succeeds unaudited. Transactional audit forces a choice:
  - **(A) Strict** — audit failure rolls back the whole action (needs a non-swallowing write path; `logAdminAction` currently never propagates).
  - **(B) Swallow** — audit failure inside the transaction still commits the mutation; closes only the crash window, not the audit-outage window.
- Out of scope: the ~25 controller-side `logAdminAction` call sites (request-scoped, not workflow crash semantics), the in-memory failed-notification queue, boot-time recovery of orphaned `running` runs, and storage retention configuration.

## Capabilities

### New Capabilities

- `workflow-audit-atomicity`: Audit entries for destructive Mastra workflow mutations (cancel, lock, unlock user; delete user appointments) are written atomically with the mutation they describe.

### Modified Capabilities

- (none)

## Impact

- **Code**: `app/actions/mastra/workflows/cancel-user-workflow.ts`, `lock-user-workflow.ts`, `unlock-user-workflow.ts`, `delete-user-appointments.ts`; possibly `app/data/audit-log.ts` (a non-swallowing write variant if option A is chosen).
- **Behavior**: workflow output schemas keep `auditLogged`; under option A an audit failure becomes a workflow failure surfaced to the admin instead of a silent unaudited success.
- **Tests**: `app/actions/mastra/workflows.test.ts` — existing audit-logging assertions need updating; new assertions for atomicity (audit failure → no mutation under option A).
- **No schema or API changes**: `audit_logs` table is unchanged; no external interfaces change.
