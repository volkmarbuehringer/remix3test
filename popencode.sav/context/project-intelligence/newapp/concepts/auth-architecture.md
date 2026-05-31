<!-- Context: project-intelligence/newapp/concepts/auth-architecture | Priority: high | Version: 1.1 | Updated: 2026-05-14 -->

# Concept: Auth Architecture

**Core Idea**: Session-based authentication using `remix/auth` credentials provider + `remix/auth-middleware` session scheme. Auth state is available as `context.auth` after the `loadAuth()` middleware runs.

---

## Auth Flow

```
Request → session() middleware (restores session from cookie)
        → loadAuth() middleware (reads auth state from session)
        → Controller (context.auth contains User or null)
        → requireAuth() middleware (redirects if not authenticated)
        → requireAdmin() middleware (403 if not admin)
```

## Components

### Password Credentials Provider
`app/middleware/auth.ts` — `passwordProvider` uses `createCredentialsAuthProvider`:
- **parse**: Reads email/password from `context.formData`
- **verify**: Looks up user by email, verifies password hash

### Session Auth Scheme
`app/middleware/auth.ts` — `loadAuth()` returns `auth()` with `createSessionAuthScheme`:
- **read**: Extracts `{ userId }` from session's `auth` key
- **verify**: Loads full User from database by userId
- **invalidate**: Clears session's `auth` key on logout

### requireAuth Middleware
- Uses `requireAuthenticatedUser` from `remix/auth-middleware`
- On failure: redirects to `/login?returnTo=<current_path>` preserving return URL
- See [auth redirect flow guide](../guides/auth-redirect-flow.md)

### requireAdmin Middleware
`app/middleware/admin.ts` — Custom middleware checking `auth.identity.role === 'admin'`:
- Not authenticated → redirect to login
- Not admin → 403 HTML page (or custom forbidden response)
- Uses `context.get(Auth)` (anonymous context — middleware signature)

### Login Action Flow
```
GET /login  → LoginPage renders with optional returnTo
POST /login → verifyCredentials(passwordProvider, context)
  → Success: session.set('auth', { userId }), redirect to returnTo
  → Failure: re-render LoginPage with error
```

### Logout
`app/actions/auth-logout.tsx` — Standalone POST action:
- Calls `auth.logout(context)` which invokes the scheme's `invalidate`
- `session.regenerateId(true)` — passes `true` to hard-regenerate session ID
- Redirects to `/`

### Session Hardening
- **Login**: `completeAuth(context)` standardizes session creation after credential verification. Returns session for further mutation. Replaces manual `context.session` + `regenerateId(true)`.
- **Logout**: `session.regenerateId(true)` passes `true` for consistent session destruction (matches login behavior)
- **Rule**: Always use `completeAuth()` on login; always pass `true` to `regenerateId()` on both login and logout

### Login Rate Limiting
Inline per-email rate limiter in login controller: 5 failed attempts / 15s window via in-memory `Map` (resets on restart). HTTP 429 on throttle. Register lacks rate limiting.

### Controller-Level Auth Protection
`requireAuth()` applied per-controller via `middleware: []` (see [controller pattern](../guides/controller-pattern.md)). Protected controllers: admin, AI, client (/client CRUD), lists (/lists routes). Public controllers: home, assets, UI showcase, auth (login, register, logout).

## Key Decisions

1. **Session over JWT** — Server-side session storage via `remix/session/fs-storage`, cookie carries session ID only
2. **returnTo preservation** — Auth middleware captures current URL before redirect, login form encodes it in action URL to prevent query stripping
3. **Login rate limiting (inline)** — Per-email in-memory rate limiter on `/login` POST: 5 attempts / 15s. Register endpoint still lacks rate limiting (see [known issues](../lookup/known-issues.md))
4. **Controller-level auth** — `requireAuth()` applied per-controller via `middleware: []`, not in global stack. New controllers get auth by adding the middleware, not by route whitelisting

## 📂 Codebase References

**Middleware**: `app/middleware/auth.ts` (loadAuth/passwordProvider/requireAuth), `app/middleware/admin.ts` (requireAdmin)
**Auth actions**: `app/actions/auth-login-controller.tsx` (completeAuth), `app/actions/auth-logout.tsx` (regenerateId), `app/actions/auth-register-controller.tsx`
**Protected controllers**: `app/actions/client/controller.tsx`, `app/actions/lists-controller.tsx`, `app/actions/admin-controller.tsx`, `app/actions/ai-controller.tsx`
**Supporting**: `app/middleware/session.ts`, `app/utils/password-hash.ts`, `app/utils/redirect.ts`, `app/actions/client/controller.test.ts`

## Related

- [Auth redirect flow](../guides/auth-redirect-flow.md) — returnTo details
- [Middleware chain](./middleware-chain.md) — Stack ordering
- [Flat Controller Pattern](../guides/flat-controller-pattern.md) — Lists controller pattern
- [Client Lab Architecture](./client-lab-architecture.md) — Auth-protected CRUD
- [Known issues](../lookup/known-issues.md) — Register rate limiting gap
