## 1. Update agent instructions

- [x] 1.1 In `app/actions/mastra/agents/workflow-agent.ts`, modify the instructions to add appointment query detection: if the question is about appointments, navigate to `/verwaltung/appointments` with appropriate `filter`, `period`, and/or `status` query params, then wait for the next question
- [x] 1.2 Add the mapping table for date references (today→today, this week→this_week, etc.) and status references (pending→pending, past→expired, etc.) to the agent instructions
- [x] 1.3 Ensure the existing user flow (navigate to `/admin/users` → ask_user → execute → consistency_checks) is unchanged and clearly separated from the appointment flow

## 2. Write tests

- [x] 2.1 Add test cases in `app/actions/workflow-agent/controller.test.ts` that submit appointment-related messages and verify the SSE response contains a navigate event targeting `/verwaltung/appointments` with the expected query params
- [x] 2.2 Verify existing user management tests still pass unchanged

## 3. Verify

- [x] 3.1 Run `npm test` to confirm all tests pass
- [x] 3.2 Run `npm run typecheck` to confirm no type errors
