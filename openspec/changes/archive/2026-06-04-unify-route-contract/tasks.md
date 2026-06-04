## 1. Routes file

- [x] 1.1 Merge 7 route exports into single `routes` object in `app/routes.ts`: nest `lists` under `route('lists', {...})`, nest `auth` under `route('auth', {...})`, merge `appointmentRoutes`, `adminRoutes`, `verwaltungRoutes`, and `aiRoutes` into the main tree. Remove the 6 secondary exports (`listsRoutes`, `authRoutes`, `appointmentRoutes`, `adminRoutes`, `verwaltungRoutes`, `aiRoutes`).

## 2. Router

- [x] 2.1 Update `app/router.ts` to import only `{ routes }` from `app/routes.ts`. Remove secondary import destructuring.
- [x] 2.2 Replace `router.post('/logout', authLogout)` with `router.map(routes.auth.logout, logoutController)`.
- [x] 2.3 Update all `router.map()` calls to use `routes.<subtree>` paths instead of secondary export references.

## 3. Auth controllers

- [x] 3.1 Update `app/actions/auth-login/controller.tsx`: change import from `authRoutes` to `routes`, update `createController` type argument and `formAction` string, ensure returnTo param handling uses typed href.
- [x] 3.2 Update `app/actions/auth-register/controller.tsx`: change import from `authRoutes` to `routes`, update `createController` type argument and `AuthForm action` href.
- [x] 3.3 Update `app/actions/auth-logout/controller.tsx`: change import from both `routes` and `authRoutes` to single `routes`, update `createAction` type argument.

## 4. Lists controller

- [x] 4.1 Update `app/actions/lists/controller.tsx`: change import from `listsRoutes as routes` to `routes`, update `createController` to target `routes.lists`, update action keys to match new nested names (`index`, `save`, `update`, `show`, `data`).

## 5. Appointment controllers

- [x] 5.1 Update `app/actions/appointment/controller.tsx`: change import to `routes`, update `createController` reference, replace hardcoded `'/login'` redirect with `routes.auth.login.index.href()`.
- [x] 5.2 Update `app/actions/appointtype/controller.tsx`: change import to `routes`, update `createController` reference.

## 6. Admin controllers

- [x] 6.1 Update `app/actions/admin/controller.tsx`: change import to `routes`.
- [x] 6.2 Update `app/actions/admin-chatlog/controller.tsx`: change import to `routes`.
- [x] 6.3 Update `app/actions/admin-chatlog-fragments/controller.tsx`: change import to `routes`.
- [x] 6.4 Update `app/actions/admin-messages/controller.tsx`: change import to `routes`.
- [x] 6.5 Update `app/actions/admin-fragments/controller.tsx`: change import to `routes`.
- [x] 6.6 Update `app/actions/admin-lists/controller.tsx`: change import to `routes`.
- [x] 6.7 Update `app/actions/admin-users/controller.tsx`: change import to `routes`.

## 7. AI controllers

- [x] 7.1 Update `app/actions/ai/controller.tsx`: change import to `routes`.
- [x] 7.2 Update `app/actions/ai-fragments/controller.tsx`: change import to `routes`.
- [x] 7.3 Update `app/actions/chat/controller.tsx`: change import to `routes`.
- [x] 7.4 Update `app/actions/agent/controller.tsx`: change import to `routes`.
- [x] 7.5 Update `app/actions/workflow/controller.tsx`: change import to `routes`.

## 8. Verwaltung controllers

- [x] 8.1 Update `app/actions/verwaltung/controller.tsx`: change import to `routes`.
- [x] 8.2 Update `app/actions/admin-offerings/controller.tsx`: change import to `routes`.
- [x] 8.3 Update `app/actions/admin-appointments/controller.tsx`: change import to `routes`.
- [x] 8.4 Update `app/actions/admin-resources/controller.tsx`: change import to `routes`.
- [x] 8.5 Update `app/actions/admin-offering-configs/controller.tsx`: change import to `routes`.

## 9. UI hardcoded URL fixes

- [x] 9.1 Fix `app/ui/scaffold-home-page.tsx`: replace `/register`, `/login` strings with `routes.auth.register.index.href()` and `routes.auth.login.index.href()`.
- [x] 9.2 Fix `app/ui/appointment-sidebar.tsx`: replace `<form action="/logout">` with typed href.
- [x] 9.3 Audit remaining UI and middleware files for any other hardcoded `/login`, `/register`, `/logout` strings and replace them.

## 10. Test files

- [x] 10.1 Update `app/actions/auth-login/controller.test.ts`: replace hardcoded `${BASE}/login` with `routes.auth.login.index.href()`.
- [x] 10.2 Update `app/ui/csrf-token-input.test.tsx`: replace hardcoded `${BASE}/login` with `routes.auth.login.index.href()`.
- [x] 10.3 Update `app/actions/nutzer/controller.test.tsx`: update login redirect assertion from `/login` to typed href.
- [x] 10.4 Update any other test files that reference legacy auth URLs or old route export patterns.

## 11. Verification

- [x] 11.1 Run `npm run typecheck` and fix any type errors from route name mismatches.
- [x] 11.2 Run `npm test` and verify all tests pass with updated URL references.
- [x] 11.3 Run `npm run start` and manually smoke-test login, register, logout flows at their new `/auth/*` URLs.
