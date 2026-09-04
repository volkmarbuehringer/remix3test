## 1. Auth identity helper

- [x] 1.1 In `app/utils/context.ts`, change `getAdminIdentity` param from `AuthState<any> | undefined` to `AuthState<User> | undefined` and drop the `as unknown as` cast; verify `npm run typecheck` passes

## 2. Auth middleware type fix

- [x] 2.1 In `app/middleware/auth.ts`, pass the `User` type param to `requireAuthenticatedUser<User>` so `requireAuth()` provides `GoodAuth<User>` instead of `GoodAuth<unknown>`; verify `npm run typecheck` passes
- [x] 2.2 In `app/actions/appointment/controller.tsx`, drop the 8 `context.auth as { identity: User }` casts now that `context.auth` is `GoodAuth<User>`; verify `npm run typecheck` passes
- [x] 2.3 In `app/actions/appointments-new/controller.tsx`, drop the `context.auth as { identity: { id, role } }` casts (lines ~392/399/595) and the `(context.auth.identity as { role }).role` cast (line ~226); verify `npm run typecheck` passes

## 3. Narrow-slice helpers (render-only, url-only, db)

- [x] 3.1 `app/actions/appointments-new/controller.tsx:52` — type `redirectToLogin` as `{ url: AppContext['url'] }`; verify `npm run typecheck` passes
- [x] 3.2 `app/actions/appointments-new/controller.tsx:350` — type `renderAppointmentsNewPage` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.3 `app/actions/verwaltung/resources/controller.tsx:145` — type `renderResourcePage` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.4 `app/actions/verwaltung/appointments/controller.tsx:263` — type `renderAppointmentsPage` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.5 `app/actions/verwaltung/report1/controller.tsx:105` — type `renderReport1Page` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.6 `app/actions/verwaltung/offerings/controller.tsx:200` — type `renderOfferingsPage` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.7 `app/actions/verwaltung/offering-configs/controller.tsx:182` — type `renderOfferingConfigPage` as `{ render: AppContext['render'] }`; verify `npm run typecheck` passes
- [x] 3.8 `app/actions/verwaltung/offering-configs/controller.tsx:297` — type `validateCreate` as `db: AppContext['db']`; verify `npm run typecheck` passes

## 4. Full-context helpers (multi-member)

- [x] 4.1 `app/actions/appointments-new/controller.tsx:155` — type `loadAppointmentsNewPageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.2 `app/actions/verwaltung/offerings/controller.tsx:102` — type `loadOfferingPageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.3 `app/actions/verwaltung/appointments/controller.tsx:137` — type `loadAppointmentPageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.4 `app/actions/verwaltung/resources/controller.tsx:63` — type `loadResourcePageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.5 `app/actions/verwaltung/offering-configs/controller.tsx:109` — type `loadOfferingConfigPageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.6 `app/actions/verwaltung/report1/controller.tsx:37` — type `loadReport1PageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.7 `app/actions/verwaltung/users-export/controller.tsx:41` — type `downloadUsersExport` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.8 `app/actions/admin/messages/controller.tsx:57` — type `renderMessagesPage` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.9 `app/actions/admin/chatlog/controller.tsx:32` — type `renderChatLogPage` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.10 `app/actions/webhook-requests/controller.tsx:34` — type `loadPageData` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes
- [x] 4.11 `app/actions/webhook-requests/controller.tsx:73` — type `renderIndexPage` as `Pick<AppContext, ...>` of its used members; verify `npm run typecheck` passes

## 5. Verification

- [x] 5.1 Run `npm run typecheck` and confirm zero errors
- [x] 5.2 Run `npm test` and confirm the affected controller suites pass (appointments-new, verwaltung/*, admin/messages, admin/chatlog, webhook-requests)
- [x] 5.3 Run `rg -n "context: any|db: any" app --type ts --type tsx` (excluding tests) and confirm zero remaining matches in controller helpers