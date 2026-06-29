## Why

External API consumers (third-party services, mobile apps, scripts) have no way to authenticate programmatically — they share a single static `WEBHOOK_TOKEN` with no user identity, scoping, or expiry. Adding a login endpoint that returns a per-user bearer token enables secure, revocable API access tied to individual accounts.

## What Changes

- New `POST /api/login` route accepting `{ email, password }` JSON body
- New `POST /api/logout` route to revoke the current token
- New `api_tokens` database table to store issued tokens with user identity, expiry, and revocation support
- Token-based authentication middleware for API routes that validates bearer tokens against the `api_tokens` table
- Migration of existing `/api/lists` from `WEBHOOK_TOKEN` static check to per-user token auth (with backward-compatible fallback)
- Rate limiting on the login endpoint (prevent brute-force)

## Capabilities

### New Capabilities
- **api-token-auth**: Token-based authentication for API routes — login endpoint, token validation middleware, token revocation, and per-user API token management

### Modified Capabilities
- <!-- No existing spec-level behavior changes — the existing `/api/lists` route currently uses a static shared token, which is an implementation detail not captured in an existing spec -->

## Impact

- `app/routes.ts` — new `api.login` and `api.logout` route definitions
- `app/router.ts` — wire new API auth routes and middleware
- `app/actions/api/` — new `login` and `logout` controllers, new or updated middleware
- `app/data/schema.ts` — new `api_tokens` table
- `app/data/seed.ts` — optional seed tokens for dev
- `app/middleware/` — new API token auth middleware or update to existing auth middleware
- `app/lib/auth-webhook.ts` — may be superseded or modified
- `app/actions/api/lists/controller.tsx` — switch from webhook token to per-user token auth
- `app/actions/api/lists/controller.test.ts` — update tests to use per-user token
