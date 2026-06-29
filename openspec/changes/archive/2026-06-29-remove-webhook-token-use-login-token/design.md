## Context

The app has two auth mechanisms for Bearer token endpoints:
1. **Per-user API tokens** stored in `api_tokens` table, validated via `api-token-auth.ts` middleware — provides identity binding, expiry, revocation.
2. **Shared `WEBHOOK_TOKEN` env var** — a static secret validated via `auth-webhook.ts` against `process.env.WEBHOOK_TOKEN`, used by `/webhook` and `/app-webhook` endpoints and as a fallback in `api-token-auth.ts`.

The per-user token system is fully operational (login, logout, token validation, expiry, revocation). The `WEBHOOK_TOKEN` fallback was kept for backward compatibility during migration. This change removes that compatibility shim.

## Goals / Non-Goals

**Goals:**
- Remove `WEBHOOK_TOKEN` env var as a valid auth credential everywhere
- Remove `app/lib/auth-webhook.ts`
- Remove `WEBHOOK_TOKEN` fallback from `api-token-auth.ts` and `api-require-auth.ts`
- Migrate `/webhook` and `/app-webhook` endpoints to use per-user API token auth
- Update all affected tests
- Update specs to reflect per-user token auth

**Non-Goals:**
- Changing the per-user token generation, storage, or validation logic
- Adding new auth mechanisms
- Changing session-based auth (web UI login)
- Modifying HMAC/webhook signing concerns (not currently used)

## Decisions

**Decision 1: Use existing `apiTokenAuth` middleware for webhook endpoints**
- `/webhook` and `/app-webhook` controllers currently call `authenticateWebhook()` directly. They should use the `apiTokenAuth` middleware chain instead, which validates against `api_tokens` table.
- Alternative considered: Inlining token validation. Rejected because it duplicates logic and misses future improvements to the middleware.
- Impact: Controllers get the same `ApiUser` context as other API endpoints, enabling per-user webhook attribution.

**Decision 2: Remove `auth-webhook.ts` entirely**
- The `authenticateWebhook()` and `verifyWebhookHmac()` functions have no callers once the two controllers are migrated.
- Alternative considered: Keeping the file and deprecating it. Rejected — unused code creates confusion.
- Impact: Cleaner codebase; one less module to maintain.

**Decision 3: Remove `WEBHOOK_TOKEN` fallback from auth middleware**
- The `api-token-auth.ts` middleware currently falls through to `WEBHOOK_TOKEN` comparison if no `api_tokens` row matches. Remove this branch so it returns 401 immediately.
- Alternative considered: Keep fallback with a deprecation warning. Rejected — the migration period is over.
- Impact: API endpoints using `apiTokenAuth` will reject tokens that don't match a valid, non-expired, non-revoked `api_tokens` row.

**Decision 4: Remove `getWebhookToken()` helper pattern**
- The `app/middleware/api-require-auth.ts` also references `process.env.WEBHOOK_TOKEN`. Remove this path.

**Decision 5: No database schema changes**
- `webhook_requests.token` column currently stores the raw `WEBHOOK_TOKEN` value. With per-user tokens, this will instead store the raw bearer token value from the `Authorization` header (the same behavior — the column stores whatever token was used).
- No migration needed for existing rows; the token column stores whatever was presented.

## Risks / Trade-offs

- **[Risk] Existing webhook senders using `WEBHOOK_TOKEN` will get 401**: Any third-party service that sends to `/webhook` or `/app-webhook` with the shared `WEBHOOK_TOKEN` will be rejected. Mitigation: Communicate the change to integrators; they must generate per-user tokens via `POST /api/login` and use those instead.
- **[Risk] Token expiry**: Per-user tokens expire after 30 days. Webhook senders need to handle token refresh. Mitigation: Document token refresh flow; consider longer-lived tokens if needed.
- **[Risk] Regression in webhook controllers**: Switching middleware changes the error response shape slightly (the middleware returns structured JSON). Mitigation: Update tests first, then controllers.
- **[Trade-off] Removes convenience**: The `WEBHOOK_TOKEN` env var was easy to set up for quick integrations. Per-user tokens require a login call first.
