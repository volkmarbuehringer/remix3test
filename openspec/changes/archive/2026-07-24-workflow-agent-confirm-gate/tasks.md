## 1. lookup_user Tool

- [x] 1.1 Create `lookupUser` tool in `workflow-agent.ts` with `id: 'lookup_user'`, input `{ query: string }`, output user data + consistency checks
- [x] 1.2 Wire `executeUserPreflightWorkflow` into the tool for user lookup and consistency data
- [x] 1.3 Register `lookupUser` in the agent's `tools` map and export in `workflowAgentTools`

## 2. Execute Tools Simplification

- [x] 2.1 Remove `confirmed` parameter from `cancelUserWorkflow_v2` input schema and all related branches in `execute()`
- [x] 2.2 Remove `confirmed` parameter from `lockUserWorkflow_v2` input schema and all related branches in `execute()`
- [x] 2.3 Remove `confirmed` parameter from `unlockUserWorkflow_v2` input schema and all related branches in `execute()`
- [x] 2.4 Make `deleteAppointments` required (not defaulted) in `cancelUserWorkflow_v2` input schema

## 3. Agent Instructions Update

- [x] 3.1 Replace USER FLOW section: lookup_user → navigate → ask_user → execute (three-phase protocol)
- [x] 3.2 Update tool descriptions for `cancel_user_workflow_v2`, `lock_user_workflow_v2`, `unlock_user_workflow_v2` to remove preflight/confirmed language
- [x] 3.3 Update cancel/lock/unlock protocol steps in instructions (remove confirmed=false/true, add ask_user gate)
- [x] 3.4 Add `lookup_user` tool documentation to agent instructions

## 4. Tests

- [x] 4.1 Add unit test for `lookup_user` tool: returns user data, no side effects, no requireApproval
- [x] 4.2 Update existing tests: remove confirmed=false calls, replace with lookup_user + execute pattern
- [ ] 4.3 Add integration test for full three-phase flow: navigate → ask_user confirm → execute
- [ ] 4.4 Add integration test for abort flow: ask_user cancel → no execute call

## 5. Verify

- [x] 5.1 Run `npm run typecheck`
- [x] 5.2 Run `npm test` — all tests pass

---

### Notes
- 4.3/4.4: Full agent protocol integration tests (navigate → ask_user → execute) require mocking the agent or adding an e2e test. Current unit tests cover the individual tools — lookup_user + execute tools all verified. The agent protocol (instructions) is a prompt change that's verified at a higher level (agent eval/scorer).
