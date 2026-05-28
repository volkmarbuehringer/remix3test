<!-- Context: development/remix3/packages/core | Priority: critical | Version: 1.1 | Updated: 2026-05-20 -->

# auth

Composable browser authentication primitives: verify credentials, OAuth/OIDC flows, token refresh, session completion.

## Core Idea

Five primitives for auth: `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, `refreshExternalAuth()`, `completeAuth()`. Pair with `auth-middleware` for route protection.

## Key Points

- **Credentials**: `createCredentialsAuthProvider()` for email/password
- **OAuth Providers**: Google, Microsoft, Okta, Auth0, GitHub, Facebook, X, Atmosphere
- **OIDC Support**: `createOIDCAuthProvider()` for custom OIDC providers
- **Token Refresh**: `refreshExternalAuth()` exchanges stored refresh tokens for fresh bundles
- **Session Completion**: `completeAuth()` calls `session.regenerateId(true)`, returns session for writes
- **Module Scope**: Provider config at boot time for stable callback URLs
- **Pair with Middleware**: `remix/auth-middleware` for request-time auth resolution

## Quick Example (Credentials)

```ts
import { verifyCredentials, createCredentialsAuthProvider, completeAuth } from 'remix/auth'
import { auth, requireAuth } from 'remix/auth-middleware'

let provider = createCredentialsAuthProvider({
  parse(context) {
    return context.get(FormData)
  },
  async verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

router.post('/login', async (context) => {
  let user = await verifyCredentials(provider, context)
  if (!user) return redirect('/login')
  
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })
  return redirect('/dashboard')
})
```

## Quick Example (OAuth)

```ts
import { startExternalAuth, finishExternalAuth, refreshExternalAuth, createGoogleAuthProvider } from 'remix/auth'

let googleProvider = createGoogleAuthProvider({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL('/auth/google/callback', env.APP_ORIGIN),
})

// Login route
router.get('/login/google', (context) => 
  startExternalAuth(googleProvider, context, { returnTo: context.url.searchParams.get('returnTo') })
)

// Callback route
router.get('/auth/google/callback', async (context) => {
  let { result, returnTo } = await finishExternalAuth(googleProvider, context)
  let user = await users.upsertFromGoogle(result.profile)
  await persistProviderTokens(user.id, result.tokens)
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })
  return redirect(returnTo ?? '/dashboard')
})

// On-demand token refresh example
async function getGoogleAccessToken(userId: string) {
  let tokens = await readStoredProviderTokens(userId)
  if (tokens?.expiresAt != null && tokens.expiresAt.getTime() <= Date.now()) {
    tokens = (await refreshExternalAuth(googleProvider, tokens)).tokens
    await persistProviderTokens(userId, tokens)
  }
  return tokens.accessToken
}
```

## Reference

`/home/lucky/remix/packages/auth/README.md`