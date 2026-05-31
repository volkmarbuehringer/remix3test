<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Auth Middleware

**Purpose**: Request-time authentication and route protection. Resolves identity into `context.auth` (or `context.get(Auth)`) from sessions, bearer tokens, or API keys.

**Key Points**:
- Resolves auth state without mutating request objects
- `requireAuth<User>()` with typed identity and configurable `onFailure(context, auth)` for redirects/JSON
- Built-in schemes: session auth with `invalidate(session)` callback, bearer tokens (`Authorization: Bearer`), API keys
- Custom auth schemes: `{ name, authenticate(context) }` returning success, failure, or skip (undefined)
  — e.g., `createTrustedProxyAuthScheme()` reads `X-Forwarded-Email` from a trusted proxy
- Simple auth cookie: `auth()` + custom scheme + `requireAuth()` with `onFailure` returning `redirect()` or custom Response
- Auth challenges auto-forwarded to `WWW-Authenticate` header on auth failure
- Ordered fallback across multiple schemes; pairs with `remix/auth` for login flows

**Minimal Example**:
```ts
import { auth, createSessionAuthScheme, requireAuth } from 'remix/middleware/auth'
import { session } from 'remix/middleware/session'

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        createSessionAuthScheme<User, { userId: string }>({
          read(s) { return s.get('auth') as { userId: string } | null },
          verify(v) { return users.getById(v.userId) },
          invalidate(s) { s.unset('auth') },
        }),
      ],
    }),
  ],
})

router.get('/dashboard', {
  middleware: [requireAuth<User>()],
  handler(c) { return Response.json({ id: c.auth.identity.id }) },
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/auth-middleware
