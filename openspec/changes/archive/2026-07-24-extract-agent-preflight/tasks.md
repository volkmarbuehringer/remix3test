## 1. Export consistency check steps

- [x] 1.1 Export `checkLockedUsersPendingAppointments` and `checkActiveUsersPendingAppointments` from `consistency-check-workflow.ts`
- [x] 1.2 Verify the exports don't break `consistencyCheckWorkflow`

## 2. Create preflight workflow

- [x] 2.1 Create `app/actions/mastra/workflows/user-preflight-workflow.ts` with a `createStep` for user lookup
- [x] 2.2 Add a `createStep` for pending appointment count
- [x] 2.3 Build the workflow with `.parallel([lookupUser, checkPendingApps, checkLockedUsers, checkActiveUsers])` reusing the exported consistency steps
- [x] 2.4 Define typed `inputSchema` and `outputSchema` per design.md

## 3. Wire into workflow-executor

- [x] 3.1 Add `executeUserPreflightWorkflow()` to `app/actions/mastra/workflow-executor.ts`
- [x] 3.2 Export it for use by the agent tools

## 4. Register preflight workflow

- [x] 4.1 Import `userPreflightWorkflow` in `app/actions/mastra/index.ts`
- [x] 4.2 Add it to the `workflows` object

## 5. Update agent tools

- [x] 5.1 Replace inline `db.exec` user lookup with `executeUserPreflightWorkflow` in all three tools
- [x] 5.2 Remove `checkPendingAppointments` tool definition
- [x] 5.3 Remove `runConsistencyChecks` tool definition
- [x] 5.4 Remove both tools from the agent's `tools:` object and the `workflowAgentTools` export

## 6. Update the consistency check spec scenario references in the cancel report spec

- [x] 6.1 Spec delta already written during planning

## 7. Shrink agent prompt

- [x] 7.1 Remove protocol steps referencing `checkPendingAppointments` and `runConsistencyChecks`
- [x] 7.2 Update protocol to shorter sequence (preflight → navigate → confirm → execute → report)
- [x] 7.3 Remove "CRITICAL: You MUST call run_consistency_checks" rule
- [x] 8.2 Verify tests still pass (`npm test`)
- [x] 8.3 Verify typecheck passes (`npm run typecheck`)
