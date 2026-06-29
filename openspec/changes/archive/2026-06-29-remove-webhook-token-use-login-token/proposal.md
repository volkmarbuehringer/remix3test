## Why

The `WEBHOOK_TOKEN` environment variable is a shared static secret with no user identity, expiry, or revocability. Per-user API tokens generated via `POST /api/login` already exist and provide proper identity binding, 30-day expiry, and on-demand revocation. Removing the `WEBHOOK_TOKEN` fallback eliminates a backward-compatibility shim that weakens the security model and complicates the auth middleware.

## What Changes

- **Remove** `process.env.WEBHOOK_TOKEN` as a valid auth mechanism everywhere
- **Remove** `app/lib/auth-webhook.ts` (or gut `authenticateWebhook` to delegate to per-user token auth)
- **Update** `app/middleware/api-token-auth.ts` to remove the `WEBHOOK_TOKEN` fallback
- **Update** `app/middleware/api-require-auth.ts` to remove the `WEBHOOK_TOKEN` fallback
- **Update** `app/actions/webhook/controller.tsx` to use per-user token auth instead of `authenticateWebhook()`
- **Update** `app/actions/app-webhook/controller.tsx` to use per-user token auth instead of `authenticateWebhook()`
- **Update** spec files to reflect per-user token auth
- **Update** tests that rely on `process.env.WEBHOOK_TOKEN`

## Capabilities

### New Capabilities
- *(none — per-user API tokens already exist)*

### Modified Capabilities
- `webhook-ingestion`: Auth mechanism changes from `WEBHOOK_TOKEN` comparison to per-user API token lookup
- `app-webhook-hermes`: Auth mechanism changes from `WEBHOOK_TOKEN` comparison to per-user API token lookup
- `api-token-auth`: The `api-token-auth` middleware drops the `WEBHOOK_TOKEN` backward-compatible fallback

## Impact

- **Code removal**: `app/lib/auth-webhook.ts` — the `authenticateWebhook()` function and `verifyWebhookHmac()` are no longer needed. The HMAC verification is only called inside `authenticateWebhook`, so it goes too.
- **Middleware simplification**: `api-token-auth.ts` and `api-require-auth.ts` lose their webhook fallback branches
- **Controller changes**: `webhook/controller.tsx` and `app-webhook/controller.tsx` switch to `apiTokenAuth()` middleware
- **Spec updates**: `webhook-ingestion/spec.md` and `app-webhook-hermes/spec.md` reflect per-user token auth
- **Test updates**: Remove `process.env.WEBHOOK_TOKEN` setup; tests use per-user token generation instead
- **Env config**: `WEBHOOK_TOKEN` no longer required; can be removed from deployment env
