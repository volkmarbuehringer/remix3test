## 1. Route Definitions

- [x] 1.1 Change `webhookRoute` in `app/routes.ts` from `post('/webhook/:token')` to `post('/webhook')`
- [x] 1.2 Change `appWebhookRoute` in `app/routes.ts` from `post('/app-webhook/:token')` to `post('/app-webhook')`

## 2. CSRF Skip Middleware

- [x] 2.1 Update `app/middleware/skip-csrf.ts` path matching from `startsWith('/webhook/')` to `=== '/webhook'`
- [x] 2.2 Update `app/middleware/skip-csrf.ts` path matching from `startsWith('/app-webhook/')` to `=== '/app-webhook'`

## 3. Webhook Controller Auth

- [x] 3.1 Replace `context.params.token` with `Authorization: Bearer` header parsing in `app/actions/webhook/controller.tsx`
- [x] 3.2 Add missing-header check (401 if no `Authorization` header)
- [x] 3.3 Add non-Bearer scheme check (401 if scheme is not `Bearer`)
- [x] 3.4 Extract token value from `Bearer <token>` and compare against `WEBHOOK_TOKEN`
- [x] 3.5 Pass the extracted token value (not URL param) to the `token` column INSERT

## 4. App-Webhook Controller Auth

- [x] 4.1 Replace `context.params.token` with `Authorization: Bearer` header parsing in `app/actions/app-webhook/controller.tsx`
- [x] 4.2 Add missing-header check (401 if no `Authorization` header)
- [x] 4.3 Add non-Bearer scheme check (401 if scheme is not `Bearer`)
- [x] 4.4 Extract token value from `Bearer <token>` and compare against `WEBHOOK_TOKEN`
- [x] 4.5 Pass the extracted token value (not URL param) to the `token` column INSERT

## 5. Verify

- [x] 5.1 Run `npm run typecheck` to confirm no type errors
- [x] 5.2 Run `npm test` to confirm existing tests pass
