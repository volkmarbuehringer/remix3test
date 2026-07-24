## 1. Drop explicit AppContext generic

- [x] 1.1 Remove `AppContext` import and second generic from `app/actions/home/controller.tsx`
- [x] 1.2 Remove `AppContext` import and second generic from `app/actions/uploads/controller.tsx`
- [x] 1.3 Remove `AppContext` import and second generic from `app/actions/settings/controller.tsx`
- [x] 1.4 Remove `AppContext` import and second generic from `app/actions/lists/controller.tsx`
- [x] 1.5 Remove `AppContext` import and second generic from `app/actions/client/controller.tsx`
- [x] 1.6 Remove `AppContext` import and second generic from `app/actions/nutzer/controller.tsx`
- [x] 1.7 Remove `AppContext` import and second generic from `app/actions/appointments-new/controller.tsx`
- [x] 1.8 Remove `AppContext` import and second generic from `app/actions/appointment/controller.tsx` (2 exports)
- [x] 1.9 Remove `AppContext` import and second generic from `app/actions/auth/controller.tsx` (4 exports)
- [x] 1.10 Remove `AppContext` import and second generic from `app/actions/chat/controller.tsx`
- [x] 1.11 Remove `AppContext` import and second generic from `app/actions/mastra/controller.tsx`
- [x] 1.12 Remove `AppContext` import and second generic from `app/actions/test-agent/controller.tsx`
- [x] 1.13 Remove `AppContext` import and second generic from `app/actions/route-agent/controller.tsx`
- [x] 1.14 Remove `AppContext` import and second generic from `app/actions/workflow-agent/controller.tsx`
- [x] 1.15 Remove `AppContext` import and second generic from `app/actions/admin/dashboard/controller.tsx`
- [x] 1.16 Remove `AppContext` import and second generic from `app/actions/admin/chatlog/controller.tsx` (2 exports)
- [x] 1.17 Remove `AppContext` import and second generic from `app/actions/admin/fragments/controller.tsx`
- [x] 1.18 Remove `AppContext` import and second generic from `app/actions/admin/messages/controller.tsx`
- [x] 1.19 Remove `AppContext` import and second generic from `app/actions/admin/lists/controller.tsx`
- [x] 1.20 Remove `AppContext` import and second generic from `app/actions/admin/users/controller.tsx`
- [x] 1.21 Remove `AppContext` import and second generic from `app/actions/api/lists/controller.tsx`
- [x] 1.22 Remove `AppContext` import and second generic from `app/actions/api/login/controller.tsx`
- [x] 1.23 Remove `AppContext` import and second generic from `app/actions/api/logout/controller.tsx`
- [x] 1.24 Remove `AppContext` import and second generic from `app/actions/webhook/controller.tsx`
- [x] 1.25 Remove `AppContext` import and second generic from `app/actions/app-webhook/controller.tsx`
- [x] 1.26 Remove `AppContext` import and second generic from `app/actions/callback/controller.tsx`
- [x] 1.27 Remove `AppContext` import and second generic from `app/actions/webhook-requests/controller.tsx` (4 exports)
- [x] 1.28 Remove `AppContext` import and second generic from `app/actions/webhook-requests/create/controller.tsx`
- [x] 1.29 Remove `AppContext` import and second generic from `app/actions/verwaltung/controller.tsx`
- [x] 1.30 Remove `AppContext` import and second generic from `app/actions/verwaltung/appointments/controller.tsx`
- [x] 1.31 Remove `AppContext` import and second generic from `app/actions/verwaltung/offering-configs/controller.tsx`
- [x] 1.32 Remove `AppContext` import and second generic from `app/actions/verwaltung/offerings/controller.tsx`
- [x] 1.33 Remove `AppContext` import and second generic from `app/actions/verwaltung/pdf/controller.tsx`
- [x] 1.34 Remove `AppContext` import and second generic from `app/actions/verwaltung/report1/controller.tsx`
- [x] 1.35 Remove `AppContext` import and second generic from `app/actions/verwaltung/resources/controller.tsx`
- [x] 1.36 Remove `AppContext` import and second generic from `app/actions/verwaltung/users-export/controller.tsx`
- [x] 1.37 Remove `AppContext` import and second generic from `app/actions/verwaltung/users-pdf/controller.tsx`
- [x] 1.38 Verify typecheck passes: `npm run typecheck`
- [x] 1.39 Fix pre-existing lint errors (3 `let`→`const` in test-pool.ts, mastra/storage.ts) and typecheck error (pool import path in nutzer/controller.test.tsx)

## 2. Adopt router.mount() for route groups (SKIPPED)

`mount()` prepends its prefix to all route patterns registered inside. `routes.admin` and `routes.verwaltung` already have their prefixes baked into their route definitions (e.g., `route('admin', { ... })`), so mounting them under another prefix would double it. Would require restructuring route definitions — out of scope for this change.

## 3. Use direct context properties consistently

- [x] 3.1 Replace `context.get(Logger)` with `context.logger` in all action controllers (12 occurrences)
- [x] 3.2 Replace `context.get(JsonBody)` with `context.jsonBody` in all action controllers (9 occurrences)
- [x] 3.3 Replace `context.get(ApiUser)` with `context.apiUser` in all action controllers (6 occurrences, except in apiListsRateLimit middleware where bare `Middleware` type doesn't see upstream transforms)
- [x] 3.4 Delete unused `Logger`, `JsonBody`, `ApiUser` key imports where they become unreferenced
- [x] 3.5 Verify typecheck passes
