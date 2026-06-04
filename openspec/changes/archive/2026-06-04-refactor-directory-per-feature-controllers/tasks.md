## 1. Migrate simple standalone controllers

- [x] 1.1 Move `controller.tsx` + `controller.ui.test.ts` into `app/actions/home/` (rename to `controller.tsx`)
- [x] 1.2 Move `lists-controller.tsx` + `lists-controller.test.ts` + `lists-show-page.tsx` into `app/actions/lists/` (controller → `controller.tsx`, page → `show-page.tsx`)
- [x] 1.3 Move `verwaltung-controller.tsx` into `app/actions/verwaltung/controller.tsx`
- [x] 1.4 Update `app/router.ts` imports for home, lists, verwaltung
- [x] 1.5 Run typecheck and tests for migrated controllers

## 2. Migrate admin frame controller

- [x] 2.1 Move `admin-controller.tsx` into `app/actions/admin/controller.tsx`
- [x] 2.2 Update `app/router.ts` import for admin controller
- [x] 2.3 Run typecheck to verify

## 3. Migrate admin-appointments controller

- [x] 3.1 Move `admin-appointments-controller.tsx` + all test files + test-utils into `app/actions/admin-appointments/` (controller → `controller.tsx`)
- [x] 3.2 Update `app/router.ts` import for admin-appointments
- [x] 3.3 Run admin-appointments tests and verify they pass

## 4. Migrate admin-chatlog controller

- [x] 4.1 Move `admin-chatlog-controller.tsx` + `admin-chatlog-controller.test.ts` into `app/actions/admin-chatlog/` (controller → `controller.tsx`)
- [x] 4.2 Update `app/router.ts` import for admin-chatlog
- [x] 4.3 Run admin-chatlog tests and verify they pass

## 5. Migrate admin-chatlog-fragments controller

- [x] 5.1 Move `admin-chatlog-fragments-controller.tsx` + `admin-chatlog-fragments-controller.test.ts` into `app/actions/admin-chatlog-fragments/` (controller → `controller.tsx`)
- [x] 5.2 Update `app/router.ts` import for admin-chatlog-fragments
- [x] 5.3 Run admin-chatlog-fragments tests and verify they pass

## 6. Migrate admin-fragments controller

- [x] 6.1 Move `admin-fragments-controller.tsx` + `admin-fragments-controller.test.ts` into `app/actions/admin-fragments/` (controller → `controller.tsx`)
- [x] 6.2 Update `app/router.ts` import for admin-fragments
- [x] 6.3 Run admin-fragments tests and verify they pass

## 7. Migrate admin-lists controller

- [x] 7.1 Move `admin-lists-controller.tsx` into `app/actions/admin-lists/controller.tsx`
- [x] 7.2 Update `app/router.ts` import for admin-lists
- [x] 7.3 Run typecheck to verify

## 8. Migrate admin-messages controller

- [x] 8.1 Move `admin-messages-controller.tsx` + `admin-messages-controller.test.ts` into `app/actions/admin-messages/` (controller → `controller.tsx`)
- [x] 8.2 Update `app/router.ts` import for admin-messages
- [x] 8.3 Run admin-messages tests and verify they pass

## 9. Migrate admin-offering-configs controller

- [x] 9.1 Move `admin-offering-configs-controller.tsx` + `admin-offering-configs-controller.test.ts` into `app/actions/admin-offering-configs/` (controller → `controller.tsx`)
- [x] 9.2 Update `app/router.ts` import for admin-offering-configs
- [x] 9.3 Run admin-offering-configs tests and verify they pass

## 10. Migrate admin-offerings controller

- [x] 10.1 Move `admin-offerings-controller.tsx` into `app/actions/admin-offerings/controller.tsx`
- [x] 10.2 Update `app/router.ts` import for admin-offerings
- [x] 10.3 Run typecheck to verify

## 11. Migrate admin-resources controller

- [x] 11.1 Move `admin-resources-controller.tsx` + `admin-resources-controller.test.ts` into `app/actions/admin-resources/` (controller → `controller.tsx`)
- [x] 11.2 Update `app/router.ts` import for admin-resources
- [x] 11.3 Run admin-resources tests and verify they pass

## 12. Migrate admin-users controller

- [x] 12.1 Move `admin-users-controller.tsx` + `admin-users-controller.test.ts` into `app/actions/admin-users/` (controller → `controller.tsx`)
- [x] 12.2 Update `app/router.ts` import for admin-users
- [x] 12.3 Run admin-users tests and verify they pass

## 13. Migrate auth-login controller

- [x] 13.1 Move `auth-login-controller.tsx` + `auth-login-controller.test.ts` into `app/actions/auth-login/` (controller → `controller.tsx`)
- [x] 13.2 Update `app/router.ts` import for auth-login
- [x] 13.3 Run auth-login tests and verify they pass

## 14. Migrate auth-register controller

- [x] 14.1 Move `auth-register-controller.tsx` + `auth-register-controller.test.ts` into `app/actions/auth-register/` (controller → `controller.tsx`)
- [x] 14.2 Update `app/router.ts` import for auth-register
- [x] 14.3 Run auth-register tests and verify they pass

## 15. Migrate auth-logout controller

- [x] 15.1 Move `auth-logout.tsx` + `auth-logout.test.ts` into `app/actions/auth-logout/` (controller → `controller.tsx`)
- [x] 15.2 Update `app/router.ts` import for auth-logout
- [x] 15.3 Run auth-logout tests and verify they pass

## 16. Handle shared auth E2E test

- [x] 16.1 Move `auth.test.e2e.ts` into `app/actions/auth/` directory (shared auth E2E test covering login + register)
- [x] 16.2 Verify E2E test file references still resolve correctly

## 17. Migrate ai-controller

- [x] 17.1 Move `ai-controller.tsx` + `ai-controller.test.ts` into `app/actions/ai/` (controller → `controller.tsx`)
- [x] 17.2 Update `app/router.ts` import for ai-controller
- [x] 17.3 Run ai tests and verify they pass

## 18. Migrate ai-fragments controller

- [x] 18.1 Move `ai-fragments-controller.tsx` + `ai-fragments-controller.test.ts` into `app/actions/ai-fragments/` (controller → `controller.tsx`)
- [x] 18.2 Update `app/router.ts` import for ai-fragments
- [x] 18.3 Run ai-fragments tests and verify they pass

## 19. Migrate agent controller

- [x] 19.1 Move `agent-controller.tsx` + `agent-controller.test.ts` into `app/actions/agent/` (controller → `controller.tsx`)
- [x] 19.2 Update `app/router.ts` import for agent
- [x] 19.3 Run agent tests and verify they pass

## 20. Migrate chat controller

- [x] 20.1 Move `chat-controller.tsx` into `app/actions/chat/controller.tsx`
- [x] 20.2 Update `app/router.ts` import for chat
- [x] 20.3 Run typecheck to verify

## 21. Migrate workflow controller

- [x] 21.1 Move `workflow-controller.tsx` + `workflow-controller.test.ts` into `app/actions/workflow/` (controller → `controller.tsx`)
- [x] 21.2 Update `app/router.ts` import for workflow
- [x] 21.3 Run workflow tests and verify they pass

## 22. Migrate remaining standalone controllers

- [x] 22.1 Move `appointtype-controller.tsx` into `app/actions/appointtype/controller.tsx`
- [x] 22.2 Move `appointment-controller.tsx` into `app/actions/appointment/controller.tsx`
- [x] 22.3 Update `app/router.ts` imports for appointtype, appointment
- [x] 22.4 Run typecheck to verify

## 23. Final verification

- [x] 23.1 Run full typecheck (`npm run typecheck` or equivalent) — must pass with zero errors
- [x] 23.2 Run full test suite — all tests must pass
- [x] 23.3 Verify no flat `*-controller.tsx` files remain in `app/actions/` root (excluding `client/` and `nutzer/` subdirs)
- [x] 23.4 Verify `git log --follow` works for moved files (at least spot-check 3 files)
