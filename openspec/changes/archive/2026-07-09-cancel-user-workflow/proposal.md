## Why

The support agent has 17 read-only tools but zero mutation capabilities. When an admin needs to cancel a user account — delete future appointments, prevent login, and block re-registration — they must leave the chat and use admin UI pages manually. This context switch breaks the support flow. Adding a `cancel-user-workflow` as the first admin mutation workflow establishes the pattern for all future admin actions.

## What Changes

- Add a `disabled_at BIGINT` column to the `users` table (migration)
- Add a `cancelUserWorkflow` Mastra workflow with 5 steps: validate target, delete future appointments, disable account, audit log, notify user
- Add a `cancel_user_account` tool to the support agent that uses ALS identity injection (matching the existing customer-tools pattern)
- Add `runWithAdminId` / `requireAdminId` AsyncLocalStorage helpers for admin tool auth context
- Wire `runWithAdminId` in the mastra chat controller around `agent.generate()`
- Add `executeCancelUserWorkflow` to `workflow-executor.ts`
- Add login gate checks for `disabled_at` in both password login and session verify paths
- No UI changes, no new routes, no changes to the customer agent

## Capabilities

### New Capabilities

- `cancel-user-workflow`: Multi-step Mastra workflow that validates the target user, deletes future appointments, disables the account (login + re-registration blocked), writes an audit log entry, and sends a best-effort notification to the cancelled user

### Modified Capabilities

- _(none — existing support agent tools remain unchanged)_

## Impact

- **New file**: `app/actions/mastra/workflows/cancel-user-workflow.ts` — 5-step workflow
- **New file**: `app/actions/mastra/tools/admin-context.ts` — `runWithAdminId` / `requireAdminId` ALS helpers
- **Modified**: `app/actions/mastra/controller.tsx` — wrap `agent.generate()` with `runWithAdminId`
- **Modified**: `app/actions/mastra/tools/support-tools.ts` — add `cancel_user_account` tool
- **Modified**: `app/actions/mastra/workflow-executor.ts` — add `executeCancelUserWorkflow`
- **Modified**: `app/actions/mastra/index.ts` — register `cancelUserWorkflow`
- **Modified**: `app/middleware/auth.ts` — add `disabled_at` checks in password verify and session verify
- **Modified**: `app/data/migrate.ts` — add `disabled_at` column migration
- **No new dependencies**: Uses existing `pool`, `audit-log`, `notifications/sender`
