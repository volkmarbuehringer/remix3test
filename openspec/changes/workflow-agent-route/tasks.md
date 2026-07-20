## 1. Lock/Unlock Workflows

- [ ] 1.1 Create `app/actions/mastra/workflows/lock-user-workflow.ts` with `lockUserWorkflow` (validate → lock → auditLog)
- [ ] 1.2 Create `app/actions/mastra/workflows/unlock-user-workflow.ts` with `unlockUserWorkflow` (validate → unlock → auditLog)
- [ ] 1.3 Register `lockUserWorkflow` and `unlockUserWorkflow` in `app/actions/mastra/index.ts`
- [ ] 1.4 Add `executeLockUserWorkflow` and `executeUnlockUserWorkflow` wrappers to `app/actions/mastra/workflow-executor.ts`
- [ ] 1.5 Write tests for lock/unlock workflows

## 2. Route Registration

- [ ] 2.1 Add `/admin/workflow-agent` route tree to `app/routes.ts`
- [ ] 2.2 Map route to controller in `app/router.ts`
- [ ] 2.3 Add route label in `app/route-labels.ts`
- [ ] 2.4 Add sidebar entry in admin layout

## 3. Workflow Agent

- [ ] 3.1 Create `app/actions/mastra/agents/workflow-agent.ts` with `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2` tools
- [ ] 3.2 Implement `cancelUserWorkflow_v2` tool: lookup → navigate → confirm → check appointments → execute cancelUserWorkflow
- [ ] 3.3 Implement `lockUserWorkflow_v2` tool: lookup → navigate → confirm → execute lockUserWorkflow
- [ ] 3.4 Implement `unlockUserWorkflow_v2` tool: lookup → navigate → confirm → execute unlockUserWorkflow
- [ ] 3.5 Register `workflowAgent` in `app/actions/mastra/index.ts`

## 4. Controller and UI

- [ ] 4.1 Create `app/actions/workflow-agent/controller.tsx` with index, panel, action, answer, toolDecision actions
- [ ] 4.2 Create `app/ui/workflow-agent-page.tsx` with Frame layout and chat input
- [ ] 4.3 Wire SSE streaming and rate limiting

## 5. Tests

- [ ] 5.1 Write controller tests for the workflow-agent route
- [ ] 5.2 Write agent tool tests for cancelUserWorkflow_v2, lockUserWorkflow_v2, unlockUserWorkflow_v2
