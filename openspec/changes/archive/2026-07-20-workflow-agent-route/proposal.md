## Why

The existing support agent (at `/mastra/chat`) bundles tool execution and business logic into opaque tool handlers. Admins need a clearer separation: the agent should analyze intent and choose appropriate workflows, while workflows handle the durable multi-step data pipeline. This enables human-in-the-loop steps (navigate to existing UI, confirm, review pending data) before executing destructive operations, and makes each workflow independently observable and testable.

## What Changes

- New route `/admin/workflow-agent` with its own agent, controller, SSE endpoints, and UI page
- New `workflowAgent` with typed tools per workflow — each tool embeds lookup, navigation, askUser confirmation, and conditional workflow execution
- `cancelUserWorkflow_v2` tool: lookup user → navigate to `/admin/users?editing=<id>` → askUser confirmation → check pending appointments → askUser delete decision → execute `cancelUserWorkflow`
- `lockUserWorkflow_v2` tool: lookup user → navigate → confirm lock → execute lock (sets `disabled_at`)
- `unlockUserWorkflow_v2` tool: lookup user → navigate → confirm unlock → execute unlock
- Web-based workflows (`cancelUserWorkflow`, `lockUserWorkflow`, `unlockUserWorkflow`) as Mastra `createWorkflow` definitions with validate, execute, auditLog, and notifyUser steps
- Existing `/mastra/chat` route, `supportAgent`, and `support-tools.ts` remain unchanged

## Capabilities

### New Capabilities

- `workflow-agent-route`: New admin route with agent that maps natural language to workflow-backed tools, with navigate-confirm pattern for human-in-the-loop
- `cancel-user-workflow`: Multi-step workflow for account cancellation — validate, delete future appointments, audit log, notify user
- `lock-unlock-user-workflow`: Lock (disable login) and unlock (re-enable) workflows with audit logging

### Modified Capabilities

None — existing routes and agents are untouched.

## Impact

- New controller: `app/actions/workflow-agent/controller.tsx` (patterned after `route-agent/controller.tsx`)
- New agent: `app/actions/mastra/agents/workflow-agent.ts`
- New workflows: multiple files in `app/actions/mastra/workflows/`
- New UI: `app/ui/workflow-agent-page.tsx` with Frame layout (admin-content frame) + chat input
- Route registration: `app/routes.ts`, `app/router.ts`, `app/route-labels.ts`
- Existing code: zero changes to `mastra/controller.tsx`, `support-agent.ts`, or `support-tools.ts`
