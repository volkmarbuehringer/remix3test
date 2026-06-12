## 1. Shared teardown utility

- [x] 1.1 `teardownTestEnvironment()` kept in `controller.test-utils.ts` — needed by verwaltung tests for within-run pagination isolation

## 2. Verwaltung test files

These use `teardownTestEnvironment()` — retention required. Parallel test offerings collide on the paginated (page size 12) offerings page. **Skipped.**

## 3. Admin test files with inline after() cleanup

- [x] 3.1 `admin-users.test.ts` — removed `createdUserIds` array and `after()` cleanup block
- [x] 3.2 `admin-messages.test.ts` — removed `testMessageIds` tracking, preemptive cleanup, and `after()` block
- [x] 3.3 `admin-chatlog.test.ts` — removed `testConversationIds` tracking, preemptive `DELETE LIKE 'test-%'`, and `after()` block
- [x] 3.4 `admin-chatlog-fragments.test.ts` — removed `after()` cleanup block

## 4. Other test files with inline cleanup

- [x] 4.1 `lists/controller.test.ts` — removed `testListIds` array and `after()` cleanup block
- [x] 4.2 `settings/controller.test.ts` — removed `after()` block and inline `DELETE FROM users` queries
- [x] 4.3 `appointments-new/controller.test.ts` — removed `createdAppointmentIds` array and `after()` block
- [x] 4.4 `resources.test.ts` — removed `createdResourceIds` array and `after()` block
- [x] 4.5 `offering-configs.test.ts` — removed `createdConfigIds`/`createdResourceIds` arrays and `after()` block

## 5. Validate and test

- [x] 5.1 Run `npm run typecheck` to confirm no type errors
- [x] 5.2 Run `npm test` and confirm all tests pass
