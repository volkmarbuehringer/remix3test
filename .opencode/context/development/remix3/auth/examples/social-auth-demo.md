<!-- Context: development/remix3/examples/social-auth-demo | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Example: Social Auth Patterns

**Core Idea**: Credentials login, OAuth (Google/GitHub/X), password reset, and session-backed route protection from `~/remix/demos/social-auth/`.

## Credentials Login

```typescript
import { completeAuth, verifyCredentials, createCredentialsAuthProvider } from 'remix/auth'

export const passwordProvider = createCredentialsAuthProvider({
  parse(context) { return s.parse(loginSchema, context.get(FormData)) },
  async verify({ email, password }, context) {
    return verifyPassword(password, user.password_hash) ? user : null
  },
})
// In action:
let user = await verifyCredentials(passwordProvider, context)
let session = completeAuth(context)
session.set('auth', { userId: user.id, loginMethod: 'credentials' })
```

## OAuth Login (Google)

```typescript
import { startExternalAuth, finishExternalAuth, createGoogleAuthProvider } from 'remix/auth'

let provider = createGoogleAuthProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), origin),
})
// Start:
return await startExternalAuth(provider, context, { returnTo })
// Callback:
let { result, returnTo } = await finishExternalAuth(provider, context)
let session = completeAuth(context)
session.set('auth', { userId: user.id, loginMethod: result.provider })
```

## Auth Middleware Stack

```typescript
import { auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'

export function loadAuth() {
  return auth({
    schemes: [createSessionAuthScheme({
      read(session) { return session.get('auth') },
      async verify(value, context) { return db.find(users, value.userId) },
      invalidate(session) { session.unset('auth') },
    })],
  })
}
export const requireAuthenticated = requireAuth({ onFailure() { return redirect('/') } })
```

## Factory Router Pattern

```typescript
export function createAppRouter(options?) {
  let router = createRouter({
    middleware: [staticFiles('./public'), formData(), session(cookie, storage), loadDatabase(), loadAuth()],
  })
  router.map(routes, createRootController(options?.providers))
  router.map(routes.auth, createAuthController())
  router.map(routes.auth.google, createGoogleAuthController(options?.providers))
  return router
}
```

## Reference
- Full demo: `~/remix/demos/social-auth/`
- Full setup guide: `guides/social-auth-setup.md`
- Auth API: `remix/auth`, `remix/auth-middleware`
