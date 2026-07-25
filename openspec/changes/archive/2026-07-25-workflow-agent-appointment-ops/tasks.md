## 1. Workflow Agent — Intent Schema Update

- [x] 1.1 Update `workflow-agent.ts` instructions to describe the new `action` field (`check` / `delete-resource`) with `targetQuery` and optional `resourceQuery`
- [x] 1.2 Update the appointment detection instructions to include `period` and `status` alongside `targetQuery` in check mode
- [x] 1.3 Add `resourceQuery` description so the LLM knows to extract resource names for deletion

## 2. Controller — User Resolution for Check Action

- [x] 2.1 In the `intent.type === 'appointment'` branch, extract `intent.action` and switch on it
- [x] 2.2 For `action === 'check'`: call `resolveTargetUser(intent.targetQuery)` when `targetQuery` is non-empty
- [x] 2.3 Build navigation URL using resolved email as `filter`, plus `period` and `status` from intent
- [x] 2.4 Emit SSE `navigate` event with the URL and `complete`

## 3. Resource Resolution Utility

- [x] 3.1 Add `resolveResource(query: string)` function to the controller (looks up by ID or name ILIKE, returns `{ resourceId }` or `{ error }`)
- [x] 3.2 Handle ambiguous resource names with a clear error message

## 4. Delete-User-Appointments Workflow

- [x] 4.1 Create `app/actions/mastra/workflows/delete-user-appointments.ts` with 4 steps: preflight, confirm-gate, execute, finalize
- [x] 4.2 Preflight step: query DB for upcoming appointments matching `user_id + resource_id`, return user/resource names + count + dates
- [x] 4.3 Confirm-gate step: suspend with `{ question, actionType, targetUserName, resourceName, pendingCount }`
- [x] 4.4 Execute step: `DELETE FROM appointments WHERE user_id=$1 AND resource_id=$2 AND date>=today`
- [x] 4.5 Finalize step: `logAdminAction()` with action type `delete-appointments`
- [x] 4.6 Register the workflow in `mastra/index.ts`

## 5. Controller — Delete-Resource Dispatch

- [x] 5.1 For `action === 'delete-resource'`: resolve user via `resolveTargetUser` and resource via `resolveResource`
- [x] 5.2 Navigate to `/verwaltung/appointments?filter=<email>` before starting the workflow
- [x] 5.3 Start `deleteUserAppointmentsWorkflow` and pipe its stream via `pipeWorkflowStream`
- [x] 5.4 On workflow completion (or cancel), emit SSE `complete` and trigger frame reload

## 6. Workflow Resume — Support Multiple Workflow Types

- [x] 6.1 Update the `resume` action to accept any workflow run (not hardcoded to `userManagementWorkflow`)
- [x] 6.2 Use `run.workflowId` to determine which workflow to resume, or simply use `mastra.getWorkflow(wfId).createRun({ runId })` generically

## 7. Verify

- [x] 7.1 Run `npm run typecheck` — no type errors
- [x] 7.2 Run `npm test` — existing tests pass
- [ ] 7.3 Manual smoke test: send "show appointments for [test user]" and verify navigation with correct filter
- [ ] 7.4 Manual smoke test: send "delete appointments for [test user] in [test resource]" and verify workflow + confirmation + deletion
