<!-- Context: development/remix3/guides/auth-middleware | Priority: high | Version: 1.3 | Updated: 2026-04-11 -->

# Auth Middleware

Request-time authentication with `auth()` and `requireAuth()`. Resolves identity from sessions, bearer tokens, or API keys into `context.get(Auth)`.

## Quick Reference

- **Use when**: Protecting routes, authenticating requests
- **Key functions**: `auth()`, `requireAuth()`
- **Stores**: `context.get(Auth)` with `{ ok, identity, method }`
- **Package**: `remix/auth-middleware`

## Key Points

1. **`auth()` middleware** resolves auth state → `context.get(Auth)`
2. **`requireAuth()`** rejects unauthenticated requests (401)
3. **Auth schemes**: session, bearer token, API key
4. **Middleware order matters**: `formData()` → `session()` → `asyncContext()` → `loadDatabase()` → `loadAuth()`

## Pattern: Basic Setup

```typescript
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        createSessionAuthScheme({
          read(session) {
            return session.get('auth') as { userId: string } | null
          },
          verify(value) {
            return users.getById(value.userId)
          },
        }),
      ],
    }),
  ],
})
```

## Pattern: Protected Route

```typescript
router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  handler(context) {
    let auth = context.get(Auth) // { ok, identity, method }
    return Response.json({ id: auth.identity.id })
  },
})
```

## Pattern: Custom Auth Scheme

For trusted proxy headers:

```typescript
function createTrustedProxyAuthScheme(): AuthScheme<User> {
  return {
    name: 'trusted-proxy',
    async authenticate(context) {
      let email = context.headers.get('X-Forwarded-Email')
      if (!email) return
      let user = await users.getByEmail(email)
      if (!user) return { status: 'failure', code: 'invalid_credentials' }
      return { status: 'success', identity: user }
    },
  }
}
```

## Pattern: Frame-Aware Auth

When an unauthenticated request arrives from inside a frame (e.g., expired session), a 302 redirect to `/login` would render inside the frame — resulting in a login page embedded in the frame. Instead, detect frame requests via the `X-Remix-Frame` header and return a 401 HTML fragment:

```typescript
export function requireAuth(options?: { redirectTo?: string }) {
  let redirectTo = options?.redirectTo ?? '/login'

  return requireAuthenticatedUser({
    onFailure(context) {
      let isFrameRequest = context.request.headers.get('X-Remix-Frame') === 'true'

      if (isFrameRequest) {
        return new Response(
          '<div><h1>Not authorized</h1><p>Refresh the page to sign in again.</p></div>',
          {
            status: 401,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
          },
        )
      }

      // Normal request — redirect to login
      let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo'))
        ?? context.url.pathname
      let location = returnTo
        ? `${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`
        : redirectTo
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      })
    },
  })
}
```

**Flow**: Frame + unauthenticated → 401 fragment → client detects 401 → `window.location.assign('/login')`. Normal + unauthenticated → 302 → `/login` (unchanged).

Pairs with client-side 401 detection:
```typescript
if (response.status === 401) {
  window.location.assign(authRoutes.authLogin.index.href())
  return new Promise(() => {})
}
```

## Auth Result Shape

```typescript
// Success: { ok: true, identity: User, method: 'session' }
// Failure: { ok: false, error: { code, message, challenge? } }
```

## Anti-Patterns

❌ **Don't** call `requireAuth()` without `auth()` first:

```typescript
// BAD: requireAuth throws if auth() didn't run
middleware: [requireAuth()] // Missing auth()!
```

✅ **Do** include `auth()` in chain before `requireAuth()`:

```typescript
middleware: [session(), auth(), requireAuth()]
```

## Related

- `guides/session-middleware.md` — Session management
- `guides/typed-context.md` — Context typing
- `ui/guides/client-entry-error-handling.md` — Client-side 401 detection in resolveFrame
- `guides/frame-navigation-patterns.md` — Frame detection headers
