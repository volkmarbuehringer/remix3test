## Context

The app currently authenticates API requests via a static shared `WEBHOOK_TOKEN` environment variable checked in `authenticateWebhook()`. There is no per-user API token system. Web UI users authenticate via session cookies at `POST /auth/login` using Remix's `createCredentialsAuthProvider` and `createSessionAuthScheme`.

External API consumers (third-party services, CLI tools, mobile apps) need a way to obtain a scoped, revocable token tied to a specific user account.

## Goals / Non-Goals

**Goals:**

- New `POST /api/login` endpoint accepting `{ email, password }` JSON body, returning `{ token }` on success
- New `POST /api/logout` endpoint to revoke the current token
- New `api_tokens` database table storing issued tokens with `user_id`, `token_hash`, `expires_at`, `created_at`, `revoked_at`
- Token validation middleware that checks `Authorization: Bearer <token>` against the `api_tokens` table
- Existing `/api/lists` routes adopt per-user token auth (with fallback to `WEBHOOK_TOKEN` for backward compatibility)
- Rate limiting on `POST /api/login` to prevent brute-force attacks

**Non-Goals:**

- JWT or any signed token format (tokens are opaque random strings stored hashed in the DB, enabling immediate revocation)
- Token scopes or fine-grained permissions per token (future concern)
- Refresh tokens or automatic token rotation
- OAuth2 or OpenID Connect flows
- API token management UI (admin panel to view/revoke tokens)

## Decisions

| Decision               | Choice                                                                | Alternatives Considered                 | Rationale                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token format           | Opaque random 32-byte token (base64url), stored as SHA-256 hash       | JWT, PASETO, signed cookies             | Opaque tokens are revocable immediately (no key rotation). Hashing prevents token leakage from DB. Matches existing `verification-token.ts` pattern. |
| Storage                | New `api_tokens` table in PostgreSQL                                  | Redis, in-memory map                    | Persistent, survives restarts, natural fit with existing DB pattern, enables audit.                                                                  |
| Token expiry           | 30-day expiry, checked on each request                                | No expiry, 7-day, 90-day                | Balances usability with security. Users can re-login to get a new token.                                                                             |
| Rate limiting          | Reuse existing in-memory `rate-limiter.ts` (per-email + per-IP tiers) | Redis-based, new rate limiter           | Consistent with existing auth rate limiting pattern. Simple in-memory bucket works for single-process deployment.                                    |
| Auth middleware        | New `app/middleware/api-token-auth.ts` composition function           | Extend existing `authenticateWebhook()` | Clean separation of concerns. Can compose with `json()` middleware context key.                                                                      |
| Backward compatibility | Fallback: check `WEBHOOK_TOKEN` if no valid per-user token found      | Breaking change, feature flag           | Zero-impact migration. Existing API clients continue working. Can be deprecated later.                                                               |

## Risks / Trade-offs

- **Risk**: In-memory rate limiter resets on server restart → Mitigation: Acceptable; brute-force would need to re-saturate after restart. Rate limit memory is per-process; horizontal scaling would need a shared store.
- **Risk**: Token leak via logs or error messages → Mitigation: Never log the raw token. Only log truncated prefix (e.g., `tok_abc…xyz`). Store only SHA-256 hash in DB, never the plaintext.
- **Risk**: Backward-compatible `WEBHOOK_TOKEN` fallback creates a surface for token confusion → Mitigation: Check webhook token first, then per-user token. Document that webhook token is shared and will be deprecated.
- **Trade-off**: Opaque tokens vs JWT → Opaque requires DB lookup on every request (slower), but enables instant revocation (JWT requires a blocklist or short TTL). For this app's scale, DB lookup cost is negligible.
