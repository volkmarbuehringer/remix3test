## 1. Database Migration

- [x] 1.1 Add `api_tokens` table migration to `app/data/migrate.ts` with columns: `id SERIAL PRIMARY KEY`, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT NOT NULL UNIQUE`, `created_at BIGINT NOT NULL`, `expires_at BIGINT NOT NULL`, `revoked_at BIGINT`
- [x] 1.2 Add `api_tokens` table definition to `app/data/schema.ts` using `table()` with `beforeWrite` for `created_at` defaulting and `afterRead` for `parseIntFields`
- [x] 1.3 Export `ApiToken` type from `app/data/schema.ts`

## 2. Token Utility

- [x] 2.1 Create `app/utils/api-token.ts` with `generateApiToken()` (32 random bytes, base64url) and `hashToken(token)` (SHA-256 hex digest)
- [x] 2.2 Create `computeTokenExpiry()` returning `Date.now() + 30 * 24 * 60 * 60 * 1000`

## 3. API Token Auth Middleware

- [x] 3.1 Create `app/middleware/api-token-auth.ts` with middleware function that reads `Authorization: Bearer <token>`, hashes the token, looks up `api_tokens` by hash, verifies not expired and not revoked, attaches `user` object to context via `createContextKey`
- [x] 3.2 Create `app/middleware/api-require-auth.ts` that wraps `api-token-auth` and returns 401 JSON response if no user attached
- [x] 3.3 Add backward-compatible `WEBHOOK_TOKEN` fallback: if no match in `api_tokens`, compare against `WEBHOOK_TOKEN` env var (allows existing clients to keep working)

## 4. API Login Route

- [x] 4.1 Add `apiLogin` and `apiLogout` route definitions in `app/routes.ts`: `api: route('api', { login: post('/login'), logout: post('/logout') })`
- [x] 4.2 Create `app/actions/api/login/controller.tsx` with `POST /api/login` action: parse JSON body, validate email+password present, look up user by email, verify password via `verifyPassword()`, check `email_verified`, generate token + store hash in DB, return `{ token }` JSON
- [x] 4.3 Create `app/actions/api/logout/controller.tsx` with `POST /api/logout` action: validate bearer token, look up token hash, set `revoked_at` to now, return `{ success: true }` JSON

## 5. Wire Routes

- [x] 5.1 Export new controllers from `app/actions/api/login/controller.tsx` and `app/actions/api/logout/controller.tsx`
- [x] 5.2 Import and wire routes in `app/router.ts`: `router.post(routes.api.login, apiLogin)` and `router.post(routes.api.logout, apiLogout)`

## 6. Rate Limiting on Login

- [x] 6.1 Add per-email rate limiter (10 attempts / 60s window) in the login controller using `createRateLimiter({ windowMs: 60000, perKey: true, maxAttempts: 10 })`
- [x] 6.2 Add per-IP rate limiter (20 attempts / 60s window) using `createRateLimiter({ windowMs: 60000, perKey: true, maxAttempts: 20 })`
- [x] 6.3 Return 429 JSON response with `{ "error": "Too many requests. Try again later." }` when rate limited

## 7. Migrate /api/lists to Per-User Token Auth

- [x] 7.1 Update `app/actions/api/lists/controller.tsx` to use `api-require-auth` middleware instead of calling `authenticateWebhook()` manually in each action
- [x] 7.2 Ensure backward-compatible fallback: if neither per-user token nor webhook token matches, return 401

## 8. Update Tests

- [x] 8.1 Update `app/actions/api/lists/controller.test.ts` to generate a per-user token for test authentication instead of using the static `TEST_TOKEN`
- [x] 8.2 Add test for `POST /api/login` — successful login returns token
- [x] 8.3 Add test for `POST /api/login` — invalid credentials return 401
- [x] 8.4 Add test for `POST /api/login` — unverified email returns 403
- [x] 8.5 Add test for `POST /api/logout` — revokes token, subsequent use returns 401
- [x] 8.6 Add test for rate limiting on login endpoint

## 9. Seed Data

- [ ] 9.1 Add seed tokens for dev users in `app/data/seed.ts` (optional convenience for development)
