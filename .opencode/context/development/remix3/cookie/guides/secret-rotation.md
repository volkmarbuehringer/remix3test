<!-- Context: development/remix3/cookie/guides/secret-rotation | Priority: medium | Version: 1.0 -->

# Guide: Secret Rotation

**Purpose**: Rotate signing secrets without invalidating existing cookies.

## Core Pattern

New secrets are **prepended** to the array. `serialize()` always signs with `secrets[0]`, while `parse()` tries each secret in order until one verifies.

## Steps

1. **Add new secret FIRST**:
   ```typescript
   // Before rotation
   let cookie = createCookie('session', { secrets: ['old-secret'] })
   // After rotation — add new secret at index 0
   let cookie = createCookie('session', { secrets: ['new-secret', 'old-secret'] })
   ```

2. **New cookies are signed** with `'new-secret'` (index 0)
3. **Old cookies still verify** — `parse()` tries `'new-secret'` (fails on old sigs), then `'old-secret'` (succeeds)
4. **Removal**: Once all old cookies have expired, remove old secrets from the array

## Important

- Order matters: `secrets[0]` is always the signing key
- There is no expiration-based invalidation — manually remove old secrets
- The parse iterates all secrets; performance impact is per-secret HMAC computation, so keep the array small

## Reference

- **Source**: `packages/cookie/src/lib/cookie.ts` — `parse()` secret iteration, `serialize()` first-secret signing
- **Signing**: `packages/cookie/src/lib/sign.ts` — `sign`/`unsign` per secret

## Related

- `cookie-signing.md` — How signing works
- `cookie-class.md` — Class API with secrets option
- `parse-and-serialize.md` — Parse/serialize flow
