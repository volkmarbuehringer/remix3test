## 1. Rename route slug workflowagent2 → agent-events

- [x] 1.1 In `app/routes.ts`, change `route('workflowagent2', ...)` to `route('agent-events', ...)` and verify `router.map(routes.admin.agentEvents, ...)` still resolves (agent-events route key unchanged)
- [x] 1.2 Remove the two hardcoded `/admin/workflowagent2` literals in `app/assets/streams/public/agent-events-stream.tsx` (`handleResume` and `handleFormSubmit`), replacing them with `routes.admin.agentEvents.resume.href()` / `routes.admin.agentEvents.index.href()`, and verify `rg -n workflowagent2 app/` returns nothing
- [x] 1.3 Update `/admin/workflowagent2` path assertions in `app/actions/agent-events/controller.test.ts` to `/admin/agent-events`
- [x] 1.4 Verify: `rg -n "workflowagent2" app/ openspec/` returns no matches and the agent-events unit tests still pass

## 2. Add workflow.requested event and rework dispatch

- [x] 2.1 Add a `workflow.requested` variant to the `BaseEvent` union in `app/actions/agent-events/event-bus.ts` carrying `workflowId`, `input`, `navigate` (`href`/`target`), and `summary`, and verify the type compiles
- [x] 2.2 Rework `app/actions/agent-events/handlers/dispatch.ts`: for actionable intents (cancel/lock/unlock) emit `workflow.requested` for `userManagementWorkflow` with the resolved `{ action, targetUserId, targetQuery, adminUserId, adminEmail }` input and the `/admin/users` navigate; keep `show-appointments` as navigate-only; remove the `action.running` emit
- [x] 2.3 Update `app/actions/agent-events/handlers/register.ts` if handler registration order/events change, and add a test asserting dispatch emits `workflow.requested` for a cancel/lock/unlock intent

## 3. Controller action starts and pipes the run

- [x] 3.1 In `app/actions/agent-events/controller.tsx` `action`, on a `workflow.requested` event: enqueue the `navigate` SSE, enqueue a `start` SSE with the run id, then `pipeWorkflowStream(run.stream({ closeOnSuspend: false }), controller, signal)` and close after suspension; run starts via `mastra.getWorkflow('userManagementWorkflow').createRun({ resourceId })`
- [x] 3.2 Reuse `pipeWorkflowStream` from `app/actions/workflow-agent/workflow-sse.ts` and confirm the `workflow-step-suspended` event is forwarded so the client can render the gate
- [x] 3.3 Add/extend a controller test that a suspended run surfaces `workflow-step-suspended` with a `suspendPayload` and the run id from `start`

## 4. Resume re-attaches to the run

- [x] 4.1 Rework `app/actions/agent-events/controller.tsx` `resume` to re-attach: `mastra.getWorkflow('userManagementWorkflow').createRun({ runId })` then `run.resumeStream({ resumeData: { confirmed } })` piped through `pipeWorkflowStream`, instead of building a new EventBus and injecting `confirm.resolved`
- [x] 4.2 Remove `pendingConfirmMap`, `nextConfirmRunId`, `CONFIRM_TTL`, and the 30s `setTimeout(closeOnce, ...)` from the in-memory confirm gate; the run id is the durable handle
- [x] 4.3 Verify: a resume test re-attaches to the same run and continues from the suspension point after confirmed=true, and returns an error for an unknown run id

## 5. Remove dead EventBus handlers

- [x] 5.1 Delete `app/actions/agent-events/handlers/confirm.ts` and `app/actions/agent-events/handlers/execute.ts` and remove their registrations in `register.ts`, verifying `rg -n "confirmHandler|executeHandler" app/` only finds deletions
- [x] 5.2 Confirm `executeCancelUserWorkflow`/`executeLockUserWorkflow`/`executeUnlockUserWorkflow` remain referenced by `app/actions/mastra/workflows/user-management-workflow.ts` and `app/actions/mastra/tools/support-tools.ts`, and are NOT removed from `workflow-executor.ts`

## 6. Client stream renders gate from suspendPayload

- [x] 6.1 In `app/assets/streams/public/agent-events-stream.tsx`, track `currentRunId` from the `start` event (mirror `workflow-agent-stream.tsx`)
- [x] 6.2 Replace the `confirm-required` handling with `workflow-step-suspended` handling that renders the confirm gate from `suspendPayload` (`question`, `targetUserName`, `pendingCount`, `lockedTotal`, `activeTotal`), and keep `handleResume` posting `{ runId, confirmed }`
- [x] 6.3 Verify: a browser/unit test (or manual run) shows the gate with preflight data and resumes the same run on confirm

## 7. Verification

- [x] 7.1 Run `npm run typecheck` and confirm it passes
- [x] 7.2 Run the agent-events controller tests and the sse/browser stream tests (`npm test` filtered) and confirm green
- [x] 7.3 Run lint (`npm run lint` / oxlint) and confirm clean
- [x] 7.4 Final `rg -n "workflowagent2" .` returns no matches and `openspec validate agent-events-suspend-confirm` passes
