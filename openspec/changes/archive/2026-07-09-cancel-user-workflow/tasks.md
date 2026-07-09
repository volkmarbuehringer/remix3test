## 1. Database Migration

- [x] 1.1 Add `disabled_at BIGINT` column to `users` table in `app/data/migrate.ts` with `ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at BIGINT`
- [x] 1.2 Add `disabled_at` column definition to the `users` table schema in `app/data/schema.ts`
- [x] 1.3 Add `disabled_at` to the `parseIntFields` call in the users schema's `afterRead` if needed (BIGINT field)

## 2. Admin Context (AsyncLocalStorage)

- [x] 2.1 Create `app/actions/mastra/tools/admin-context.ts` with `runWithAdminId<T>(id: number, fn: () => T): T` and `requireAdminId(): number`, mirroring the customer-tools.ts pattern
- [x] 2.2 Wire `runWithAdminId` in `app/actions/mastra/controller.tsx` around the `agent.generate()` call in the `action` handler

## 3. Login Gate Updates

- [x] 3.1 Add `disabled_at IS NOT NULL` check in `app/middleware/auth.ts` — `verifyCredentials` (password login): return null if `user.disabled_at != null`
- [x] 3.2 Add `disabled_at IS NOT NULL` check in `app/middleware/auth.ts` — session auth scheme `verify`: return null if `user.disabled_at != null`

## 4. Cancel User Workflow

- [x] 4.1 Create `app/actions/mastra/workflows/cancel-user-workflow.ts` — step 1: `validate-target` (user exists, not admin, not already disabled)
- [x] 4.2 Add step 2: `delete-future-appointments` (DELETE WHERE user_id=$1 AND date>now, return count)
- [x] 4.3 Add step 3: `disable-account` (UPDATE disabled_at=now, token_version=tv+1, idempotent)
- [x] 4.4 Add step 4: `audit-log` (INSERT into audit_logs with action_type='user_cancelled', best-effort)
- [x] 4.5 Add step 5: `notify-user` (send email via existing notification sender, never fail workflow)
- [x] 4.6 Chain steps and commit the workflow with input/output schemas

## 5. Workflow Executor & Registration

- [x] 5.1 Add `executeCancelUserWorkflow(input)` to `app/actions/mastra/workflow-executor.ts`
- [x] 5.2 Register `cancelUserWorkflow` in `app/actions/mastra/index.ts` in the `workflows` object

## 6. Support Agent Tool

- [x] 6.1 Add `cancel_user_account` tool to `app/actions/mastra/tools/support-tools.ts` — calls `requireAdminId()`, guards self-cancellation, delegates to `executeCancelUserWorkflow`
- [x] 6.2 Update support agent instructions in `app/actions/mastra/agents/support-agent.ts` to document the new tool

## 7. Tests

- [x] 7.1 Add unit tests for `requireAdminId` / `runWithAdminId` in admin-context.ts
- [x] 7.2 Add unit tests for `cancel_user_account` tool (self-cancellation guard, admin identity propagation)
- [x] 7.3 Add unit tests for cancel-user-workflow steps (validate target, delete appointments, disable account)
- [x] 7.4 Add integration test for workflow executor
- [x] 7.5 Run `npm t` and `npm run typecheck` to verify no regressions
