## Context

The app currently sets three security headers via `app/middleware/security-headers.ts`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. No `Content-Security-Policy` exists, leaving the app unprotected against XSS via injected scripts or styles.

Rate limiting for auth endpoints (login, register) is implemented twice — each controller has its own inline `Map` with manual cleanup, rather than using the shared `createRateLimiter()` utility in `app/utils/rate-limiter.ts`. The shared utility only supports numeric (userId) and global keying, lacking string-keyed (email) mode needed for registration.

## Goals / Non-Goals

**Goals:**
- Add CSP header with directives that work with Remix 3's inline `css()` style generation
- Add HSTS (production) and Permissions-Policy headers
- Add `perKey` mode to `createRateLimiter()` for string-based rate limiting
- Migrate both auth controllers (login, register) to use the shared utility
- Ensure full test coverage for both changes

**Non-Goals:**
- Not modifying CSP during dynamic content generation (policy is static)
- Not adding per-IP rate limiting (future concern)
- Not adding CSRF token improvements beyond what exists

## Decisions

### D1: CSP `style-src 'unsafe-inline'` is required

Remix 3's `css()` function generates inline `<style>` elements at runtime. Without `'unsafe-inline'` on `style-src`, all app styles break. This is a framework constraint, not a choice.

Alternatives considered:
- **Nonce-based**: Remix 3 does not expose a nonce mechanism for `css()` blocks
- **Hash-based**: Style hashes would need per-build regeneration and are impractical with dynamic mixins

→ Decision: Accept `'unsafe-inline'` on styles. Scripts remain strictly `'self'`.

### D2: `form-action 'self'` blocks external form submissions

This prevents CSRF-style attacks where a form on an attacker's site could submit to the app's endpoints. The app has no cross-origin form submission use cases.

### D3: HSTS production-only with env check

Local development often uses HTTP. Setting HSTS in dev would require HTTPS and add friction. The production-only guard follows the existing pattern where rate limiting is gated by `PRODUCTION_RATE_LIMIT` env var in the auth controllers.

### D4: `perKey` mode joins `perUser` in rate limiter utility

The existing `createRateLimiter()` already has the architecture for keyed maps. Adding `perKey` is a natural extension that reuses the same cleanup, window, and check logic. The only difference is the key type (`string` vs `number`).

Alternatives considered:
- **Generic key type**: Union `number | string` accepted everywhere — simpler API but looser typing
- **Separate factory**: `createStringRateLimiter()` — avoids breaking existing API but duplicates logic

→ Decision: Option A (union type on existing factory) — the signatures already accept `userId?: number`, which becomes `key?: number | string`.

### D5: CSP string built once at module init, not per-request

The CSP policy is static — it doesn't change between requests. Building the string once at module scope avoids string concatenation on every request. The current security-headers middleware already follows a stateless pattern.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| CSP blocks legitimate inline scripts or external resources | Test thoroughly with the full app — appointment grid, SSE, AI chat |
| `'unsafe-inline'` on styles weakens CSP value | Acceptable — style injection is much lower risk than script injection. Scripts remain locked down |
| Register rate limiter refactor changes subtle window behavior | Existing inline uses `firstAt` tracking; the shared utility uses last-timestamp. Verify behavior is equivalent in tests |
| Login rate limiter has per-second window (≤1 req/s) | Shared utility's single-attempt window replicates this. Test confirms |
| HSTS in dev breaks local testing | Guarded by `NODE_ENV === 'production'` |
