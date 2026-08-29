# Design: Transactional Audit for Admin Workflows

## Context

Four leaf workflows in `app/actions/mastra/workflows/` mutate and audit in separate steps:

| Workflow | Mutation today | Audit today |
|---|---|---|
| `cancel-user-workflow` | one `db.transaction` (appts delete + disable + token revoke) | separate step, `try/catch` swallow |
| `lock-user-workflow` | bare `db.exec` UPDATE | separate step, swallow + `alreadyLocked` skip |
| `unlock-user-workflow` | bare `db.exec` UPDATE | separate step, swallow + `alreadyUnlocked` skip |
| `delete-user-appointments` | bare `db.exec` DELETE | separate `finalize` step, swallow |

`logAdminAction(db, entry)` (`app/data/audit-log.ts`) **swallows** errors in production and rethrows only in development. The workflow audit steps add a second `try/catch` layer. Under the user-confirmed strict semantics (Decision A), both swallow layers must be bypassed for the in-transaction write. `userManagementWorkflow` delegates to three of the four leaves via `executeActionStep`, so fixing the leaves covers the agent-routed dispatcher. Failure surfacing to admins already exists: workflow errors flow through the report/SSE paths consumed by `workflow-agent-memory` and `agent-events-confirm-execute`.

## Goals / Non-Goals

**Goals:**
- Mutation + audit entry become all-or-nothing per the `workflow-audit-atomicity` spec.
- Strict failure: audit INSERT failure rolls back the mutation and fails the workflow.
- Preserve idempotent no-op behavior (no audit entry when `affectedRows === 0`).
- Keep existing workflow output schemas (`auditLogged` field stays) so report consumers are unaffected.

**Non-Goals:**
- The ~25 controller-side `logAdminAction` call sites (request-scoped handlers; their swallow semantics stay).
- Durable notification queue, boot-time recovery of orphaned `running` runs, storage retention (separate threads).
- Changing `audit_logs` schema or adding a migration.

## Decisions

### D1: Strict semantics — audit failure fails the action (confirmed)

The audit-log INSERT failure inside the transaction propagates, rolling back the mutation. Alternative (B) — keep swallowing inside the transaction — was rejected: a swallowed error still commits the mutation, leaving the unaudited-mutation hole open for the audit-outage case; it would only close the crash window while retaining the exact bug class this change exists to fix. Real-world cost of strictness is near zero because audit and mutation share the same Postgres instance: realistic audit-INSERT failures (DB down, constraint drift) fail the mutation anyway.

### D2: Add a non-swallowing write path in `audit-log.ts`

Add `logAdminActionStrict(db, entry)` — same INSERT, no `try/catch`. Rationale for a new function over changing `logAdminAction`'s behavior: ~25 controller call sites depend on the swallow-by-default contract (documented in its docstring); flipping that default is a wider behavior change than this scope. Inlining the raw INSERT in each workflow was rejected: four copies of the same SQL and column mapping. The transaction handle (`tx`) satisfies the same `Database` interface the workflows already use for `tx.exec`, so the strict helper is callable with either `db` or `tx`.

### D3: Audit write moves into the mutation step's transaction, per workflow

- **cancel-user**: add the strict audit INSERT inside the existing `db.transaction` block of the `delete-and-disable-account` step (only on the success path where a row was disabled). The separate `audit-log` step stops writing and only carries `auditLogged` (derived: true on success) — or is removed outright if its output plumbing allows; prefer removal when no other consumer depends on the step.
- **lock/unlock**: wrap UPDATE + strict audit INSERT in one `db.transaction` (replacing the bare `db.exec`). The `affectedRows === 0` no-op path stays outside the transaction and writes no audit entry, preserving the `alreadyLocked`/`alreadyUnlocked` double-logging guard.
- **delete-user-appointments**: wrap DELETE + strict audit INSERT in one `db.transaction` inside `executeStep`; `finalize`'s audit write is removed, `auditLogged` derived from success.

### D4: Keep `auditLogged` in all output schemas

`workflow-agent-memory`'s spec requires `auditLogged` in the workflow report; downstream finalize/report plumbing consumes it. Under strict semantics it becomes derivable (`success → true`), but keeping the field avoids touching schemas and consumers. Trade-off: the field is now redundant; accepted for minimal churn.

## Risks / Trade-offs

- [Admin actions now fail when the audit write fails] → Accepted deliberately (D1). Mitigation: the propagated error must carry a clear message (e.g. "audit log write failed; action rolled back") so the admin sees why, not a generic workflow error.
- [Previously silent failures become visible in production] → That is the intent; `logAdminAction` already rethrows in development, so schema/db drift surfaces in dev first. Tests asserting the old swallow path need updating.
- [Transaction held one INSERT longer] → Negligible: single extra statement on the same connection.
- [Test churn in `app/actions/mastra/workflows.test.ts`] → Update audit assertions; add a rollback test (force the strict audit write to fail and assert no mutation persisted).

## Migration Plan

Single deploy; no schema change, no backfill, no feature flag. Rollback = revert the commit: behavior returns to swallowed audit with separate steps. No ordering constraints with other work.

## Open Questions

None — audit-failure semantics resolved (Decision A, user-confirmed).
