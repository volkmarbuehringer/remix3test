## 1. Remove webhook token auth module

- [x] 1.1 Delete `app/lib/auth-webhook.ts` — the `authenticateWebhook()` and `verifyWebhookHmac()` exports are no longer used

## 2. Remove WEBHOOK_TOKEN fallback from middleware

- [x] 2.1 In `app/middleware/api-token-auth.ts`, remove the `process.env.WEBHOOK_TOKEN` fallback branch after `api_tokens` lookup fails — return 401 directly instead
- [x] 2.2 In `app/middleware/api-require-auth.ts`, remove the `process.env.WEBHOOK_TOKEN` fallback path

## 3. Migrate webhook controllers to per-user token auth

- [x] 3.1 In `app/actions/webhook/controller.tsx`, replace `authenticateWebhook(context.request)` with `apiTokenAuth` middleware chain from `app/middleware/api-token-auth.ts`
- [x] 3.2 In `app/actions/app-webhook/controller.tsx`, replace `authenticateWebhook(context.request)` with `apiTokenAuth` middleware chain
- [x] 3.3 Remove the import of `authenticateWebhook` from both controllers

## 4. Update tests

- [x] 4.1 Update `app/actions/webhook/controller.test.ts` — replace `process.env.WEBHOOK_TOKEN` setup with per-user token generation via the test helper; tests authenticate with a valid `tok_` token
- [x] 4.2 Update `app/actions/app-webhook/controller.test.ts` — same pattern
- [x] 4.3 Remove any test references to `WEBHOOK_TOKEN` env var

## 5. Clean up

- [x] 5.1 Update the comment in `app/router.ts` line 74 that references "webhook token auth"
- [x] 5.2 Verify no remaining references to `WEBHOOK_TOKEN` in non-spec source code
- [x] 5.3 Run tests and typecheck to confirm everything passes
