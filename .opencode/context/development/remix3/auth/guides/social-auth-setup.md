<!-- Context: development/remix3/guides/social-auth-setup | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Guide: Auth Setup with Social Login

**Core Idea**: Set up a complete auth system with credentials login + OAuth providers (Google/GitHub/X) + password reset, using `remix/auth`, `remix/auth-middleware`, and `remix/session`.

## Step 1: Session Setup

```typescript
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session/fs-storage'

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret && process.env.NODE_ENV !== 'test') throw new Error('SESSION_SECRET is required')

export const sessionCookie = createCookie('session', {
  secrets: [sessionSecret], httpOnly: true, sameSite: 'Lax', maxAge: 2592000, path: '/',
})
export const sessionStorage = createFsSessionStorage('./tmp/sessions')
export { Session }
```

## Step 2: Auth Middleware

```typescript
import { auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'

export function loadAuth(schemes) {
  return auth({
    schemes: [createSessionAuthScheme({
      read(session) { return session.get('auth') },
      async verify(value, context) {
        let db = context.get(Database)
        return db.find(users, value.userId)
      },
      invalidate(session) { session.unset('auth') },
    })],
  })
}

export const requireAuthenticated = requireAuth({
  onFailure() { return redirect('/login') },
})
```

## Step 3: Credentials Provider

```typescript
import { createCredentialsAuthProvider, verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

const loginSchema = f.object({
  email: f.field(s.string()),
  password: f.field(s.string()),
})

const passwordProvider = createCredentialsAuthProvider({
  parse(context) { return s.parse(loginSchema, context.get(FormData)) },
  async verify({ email, password }, context) {
    let user = await db.findOne(users, { where: { email } })
    if (!user) return null
    return await verifyPassword(password, user.password_hash) ? user : null
  },
})
```

## Step 4: OAuth Providers

```typescript
import { createGoogleAuthProvider, createGitHubAuthProvider, createXAuthProvider } from 'remix/auth'
import { startExternalAuth, finishExternalAuth, completeAuth } from 'remix/auth'

function createGoogleProvider(origin) {
  let clientId = process.env.GOOGLE_CLIENT_ID
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return createGoogleAuthProvider({
    clientId, clientSecret,
    redirectUri: new URL(routes.auth.google.callback.href(), origin),
  })
}

// In controller:
async login(context) {
  return await startExternalAuth(provider, context, { returnTo })
},
async callback(context) {
  let { result, returnTo } = await finishExternalAuth(provider, context)
  let { user, authAccount } = await resolveExternalAuth(db, result)
  let session = completeAuth(context)
  session.set('auth', { userId: user.id, loginMethod: result.provider })
  return redirect(returnTo ?? '/account')
},
```

## Step 5: Router Wiring

```typescript
// Middleware order: static → formData → session → database → auth
let router = createRouter({
  middleware: [
    staticFiles('./public'),
    formData(),
    session(sessionCookie, sessionStorage),
    loadDatabase(),
    loadAuth(),
  ],
})

// Factory function for testable routers
export function createAppRouter(options?) {
  let cookie = options?.sessionCookie ?? sessionCookie
  let storage = options?.sessionStorage ?? sessionStorage
  let providers = options?.providers ?? defaultProviders

  let router = createRouter({ middleware: [/* ... */] })
  router.map(routes, createRootController(providers))
  router.map(routes.auth, createAuthController())
  router.map(routes.auth.google, createGoogleAuthController(providers))
  router.map(routes.auth.github, createGitHubAuthController(providers))
  router.map(routes.auth.x, createXAuthController(providers))
  return router
}
```

## Imports Summary

| Function | Package |
|----------|---------|
| `verifyCredentials`, `completeAuth` | `remix/auth` |
| `startExternalAuth`, `finishExternalAuth` | `remix/auth` |
| `createCredentialsAuthProvider` | `remix/auth` |
| `createGoogleAuthProvider`, `createGitHubAuthProvider`, `createXAuthProvider` | `remix/auth` |
| `auth`, `createSessionAuthScheme`, `requireAuth` | `remix/auth-middleware` |
| `createCookie` | `remix/cookie` |
| `createFsSessionStorage` | `remix/session/fs-storage` |
| `redirect` | `remix/response/redirect` |

## Reference

- Full demo: `~/remix/demos/social-auth/`
- Auth middleware guide: `guides/auth-middleware.md`
- Session guide: `guides/session-middleware.md`
