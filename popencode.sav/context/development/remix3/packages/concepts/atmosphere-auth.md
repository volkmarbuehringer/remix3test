<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Atmosphere Auth

**Purpose**: ATProtocol/Bluesky OAuth with DPoP binding. No separate token store needed — sealed session state via AES-GCM eliminates provider-side storage for the redirect step.

**Key Points**:
- `prepare(handleOrDid)` resolves atproto identity (handle→DID) before `startExternalAuth()`, calling back to a PDS for authorization server metadata
- DPoP-bound tokens bundle includes `accessToken`, `refreshToken`, `dpop` JWK key pair, and `authorizationServer` refresh metadata
- Sealed session state encrypts in-flight DPoP key, nonce, and resolved identity into the existing OAuth transaction via AES-GCM (requires `sessionSecret`)
- Handle resolution: DNS `_atproto.{handle}` TXT → HTTPS `{handle}/.well-known/atproto-did` → PLC directory (did:plc:) or DID web document (did:web:)
- Module-scope provider, passed directly to `finishExternalAuth()` — the original handle/DID is recovered from the sealed session state on callback

**Usage**:
```ts
import { createAtmosphereAuthProvider, startExternalAuth, finishExternalAuth, completeAuth } from 'remix/auth'

let atmosphereProvider = createAtmosphereAuthProvider({
  clientId: new URL('/oauth/client-metadata.json', env.APP_ORIGIN),
  redirectUri: new URL('/auth/atmosphere/callback', env.APP_ORIGIN),
  sessionSecret: env.SESSION_SECRET,
})

// Login route — prepare first, then start
router.get('/login/atmosphere', async (context) => {
  let prepared = await atmosphereProvider.prepare('alice.bsky.social')
  return startExternalAuth(prepared, context)
})

// Callback — same module-scope provider passed directly
router.get('/auth/atmosphere/callback', async (context) => {
  let { result, returnTo } = await finishExternalAuth(atmosphereProvider, context)
  let session = completeAuth(context)
  session.set('auth', { did: result.profile.did })
  return redirect(returnTo ?? '/dashboard')
})
```

**Reference**: `/home/lucky/remix/packages/auth/src/lib/providers/atmosphere.ts`
