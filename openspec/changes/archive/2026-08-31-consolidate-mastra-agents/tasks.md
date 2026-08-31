## 1. Remove account-mutation tools from the support agent

- [x] 1.1 Remove the `cancelUserAccount`, `lockUserAccount`, and `unlockUserAccount` tool definitions from `app/actions/mastra/tools/support-tools.ts` (plus any now-unused imports) and verify `supportTools` no longer exposes the ids `cancel_user_account`, `lock_user_account`, `unlock_user_account` by grep.
- [x] 1.2 Update `app/actions/mastra/agents/support-agent.ts`: delete the three tool instruction lines, replace the `Do NOT modify/create/delete any data except via cancel_user_account, lock_user_account, unlock_user_account` rule with a read-only rule, and rewrite the "cancel a user" final rule to redirect to Agent-Events. Verify no reference to the three tool ids remains in the file.
- [x] 1.3 Remove the `cancel_user_account` / `isCancelUser` special-case in `app/assets/streams/public/support-agent-stream.tsx`. Verify no `cancel_user_account` reference remains.
- [x] 1.4 Update `app/actions/support-agent/controller.test.ts`: remove the `cancelUserAccount` tool tests (approx. lines 959–1021) and any fixtures that only supported them. Verify `npm test` passes for this file.

## 2. Shared agent scaffolding (model / memory / tools)

- [x] 2.1 In `app/actions/mastra/agent-config.ts` add and export:  `requireApiKey()` (move the strict throwing getter from `customer-agent.ts`), `createModel()` (providerId `opencode-go`, modelId `deepseek-v4-flash`, `url: OPENCODE_API_URL`, lazy `get apiKey()`), `createMemory(options?)` (defaults to `workingMemory: { enabled: true }` over `mastraStorage`), and `withUserTools(tools)` (spreads tools + `askUserTool`). Keep `shared-agent.ts` free of DB coupling. Verify `npm run typecheck`.
- [x] 2.2 Rewire `app/actions/mastra/agents/customer-agent.ts` to use `createModel()` / `createMemory()` / `withUserTools(customerTools)` and delete the local `requireApiKey`. Verify `customer-tools.test.ts` and the chat controller tests pass.
- [x] 2.3 Rewire `app/actions/mastra/agents/support-agent.ts` to use `createModel()` / `createMemory()` / `withUserTools({ ...supportTools, routeNavigate })`. Verify the support-agent tests pass.
- [x] 2.4 Rewire `app/actions/mastra/agents/workflow-agent.ts` to use `createModel()` and `createMemory({ lastMessages: 10 })`. Verify `intent-classifier` / agent-events classification tests pass.

## 3. Verification

- [x] 3.1 Run `npm test` and `npm run typecheck`; verify the full suite is green.
- [x] 3.2 Grep the repo for `cancel_user_account`, `lock_user_account`, `unlock_user_account`, `cancelUserAccount`, `lockUserAccount`, `unlockUserAccount`; verify no unintended callers remain (expected: only historical references, if any, documented as such).
- [x] 3.3 Verify the agent-events destructive flow still works end-to-end: run the `agent-events/controller.test.ts` and `workflows.test.ts` suites; confirm cancel/lock/unlock via `/agent-events` still triggers `userManagementWorkflow` through the confirm gate.

## 4. Optional / deferred

- [x] 4.1 (Optional, deferred — UI nicety) Add a short hint in the support-agent page that account mutations now live in the "Agent-Events" surface. Not required for correctness.
