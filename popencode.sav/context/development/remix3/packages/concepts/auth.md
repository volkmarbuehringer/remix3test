<!-- Context: development/remix3/packages/concepts | Priority: critical | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Auth

**Purpose**: Browser authentication primitives for credentials, OAuth, and OIDC flows. Pairs with `remix/auth-middleware` for request-time auth.

**Key Points**:
- Five primitives: `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, `refreshExternalAuth()`, `completeAuth()`
- Built-in providers: Google, Microsoft, Okta, Auth0, GitHub, Facebook, X, Atmosphere
- `refreshExternalAuth()` exchanges stored refresh tokens for fresh token bundles from supported providers (OIDC, X, Atmosphere)
- Atmosphere provider uses DPoP-bound tokens with no separate store needed (see [atmosphere-auth](concepts/atmosphere-auth.md))
- `completeAuth()` calls `session.regenerateId(true)` to prevent session fixation
- Module-scope provider configuration for stable callback URLs
- App-owned session records (you control what to persist)
- Designed to pair with `auth-middleware` for route protection

**Minimal Example**:
```ts
import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth'

let passwordProvider = createCredentialsAuthProvider({
  async verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

router.post('/login', async (context) => {
  let user = await verifyCredentials(passwordProvider, context)
  if (user == null) return redirect('/login')
  
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })
  return redirect('/dashboard')
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/auth
