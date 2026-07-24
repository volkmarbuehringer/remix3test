## 1. Parent Workflow: userManagementWorkflow

- [x] 1.1 Create `app/actions/mastra/workflows/user-management-workflow.ts` with 4 steps: `preflightStep` (parallel nested), `confirmGateStep` (suspend/resume), `executeStep` (branched nested), `finalizeStep`
- [x] 1.2 Register `userManagementWorkflow` in `app/actions/mastra/index.ts`

## 2. Agent: Strip to Intent Resolution

- [x] 2.1 Rewrite `workflow-agent.ts` agent instructions to ~10 lines — intent resolution only, structured JSON output, no protocol management
- [x] 2.2 Remove `askUserTool`, `routeNavigate` imports from agent
- [x] 2.3 Remove all 5 workflow tools (`lookupUser`, `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2`, `generateActionReport`) from agent — these move to the controller
- [x] 2.4 Update agent toolset to minimal: only what's needed for intent resolution

## 3. Controller: Two-Phase Routing

- [x] 3.1 Rewrite POST `/workflow-agent` to: (a) call agent for intent resolution, (b) switch on intent type, (c) start `userManagementWorkflow` for user actions
- [x] 3.2 Add POST `/workflow-agent/resume` endpoint that resumes a suspended workflow step
- [ ] 3.3 Add GET `/workflow-agent/stream?runId` endpoint for reconnecting to active workflow SSE
- [x] 3.4 Remove POST `/workflow-agent/answer` and `/workflow-agent/tool-decision` endpoints
- [x] 3.5 Remove `_testAgent` injection (no longer needed — agent is fire-and-forget)
- [x] 3.6 Remove `workflowAgentRateLimiter` (rate limiting moves to workflow step level if needed)

## 4. SSE: Workflow Stream Piping

- [x] 4.1 Create `app/actions/workflow-agent/workflow-sse.ts` — utility that pipes `run.stream()` events to the HTTP response as SSE
- [x] 4.2 Handle `closeOnSuspend: false` — keep connection alive during suspension
- [x] 4.3 Handle `workflow-finish` — close the SSE connection

## 5. Page UI: State Machine

- [x] 5.1 Rewrite `app/ui/workflow-agent-page.tsx` — remove chat bubble rendering, add state machine (IDLE → RESOLVING → WORKFLOW → COMPLETE/CANCELLED)
- [x] 5.2 Add step status indicators (list of steps with checkmarks/spinners)
- [x] 5.3 Add confirm gate card rendered from suspend payload (Bestätigen/Abbrechen buttons)
- [x] 5.4 Add result display with PDF download link
- [ ] 5.5 Add cancel button that cancels the running workflow

## 6. Browser Client: Workflow SSE Handler

- [x] 6.1 Rewrite `app/assets/streams/workflow-agent-stream.browser.tsx` — handle workflow SSE events instead of agent SSE events
- [x] 6.2 Render step status updates from `workflow-step-start` and `workflow-step-result`
- [x] 6.3 Render confirm gate card from `workflow-step-suspended` (suspendPayload)
- [x] 6.4 Handle `workflow-finish` — show result, enable new action
- [ ] 6.5 Implement reconnect logic for dropped SSE connections via GET `/stream?runId`

## 7. Cleanup

- [x] 7.1 Remove unused `workflow-executor.ts` agent-side tool calls (if no other agent uses them) — still used by support-tools, customer-tools, and tests
- [x] 7.2 Remove `skip-csrf.ts` entries for removed endpoints if no longer needed — wildcard `/workflow-agent/` still covers remaining endpoints
- [x] 7.3 Update route labels if needed — no change needed
- [x] 7.4 Verify no remaining references to removed endpoints — only in archived docs and unrelated controllers

## 8. Testing

- [ ] 8.1 Add tests for `userManagementWorkflow`: preflight → suspend → resume → execute flow
- [ ] 8.2 Add tests for controller: agent returns intent, workflow starts, resume works
- [ ] 8.3 Add tests for cancelled flow: admin types new message, old workflow cancelled
- [x] 8.4 Update existing controller tests to match new endpoint surface
- [x] 8.5 Remove tests for removed endpoints (answer, tool-decision)
