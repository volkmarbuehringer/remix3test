<!-- Context: development/remix3/security/concepts/session-security | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Session Security

**Core**: Session ID regeneration after authentication changes prevents session fixation attacks. The app calls `session.regenerateId()` on login and `session.regenerateId(true)` on logout.

## Session Fixation Prevention

A session fixation attack occurs when an attacker forces a user to use a known session ID. After successful authentication, the session ID **must** be regenerated so the old (potentially attacker-known) ID becomes invalid.

### Login — regenerateId()

In `app/actions/auth-login-controller.tsx` (line 88), after successful credential verification:

```typescript
let session = completeAuth(context)
session.regenerateId()           // ← New session ID, old one invalidated
session.set('auth', { userId: user.id })
```

`session.regenerateId()` is called **before** setting auth data on the session. The old session data is preserved (copied to the new session), but the session ID itself is replaced. Any third party holding the old session ID can no longer access this session.

### Logout — regenerateId(true)

In `app/actions/auth-logout.tsx` (line 13), the `true` parameter clears all session data:

```typescript
session.unset('auth')
session.regenerateId(true)       // ← true = clear all data + new ID
```

The `true` argument to `regenerateId()` is a "clear data" flag — it creates a completely empty session with a new ID, suitable for logout where you want to discard all session state.

## When to Regenerate

| Event | Method | Purpose |
|-------|--------|---------|
| Login | `session.regenerateId()` | Prevent fixation — new session for authenticated user |
| Logout | `session.regenerateId(true)` | Clear all session state + new ID |
| Privilege escalation | `session.regenerateId()` | New session after role/permission change |
| Password change | `session.regenerateId()` | Invalidate sessions potentially compromised |

## CSRF Token Storage

The CSRF token is also stored in the session under the `_csrf` key. This is used by the `csrf()` middleware to validate incoming tokens against the session:

```typescript
// Session shape includes _csrf for CSRF validation
session.set('_csrf', csrfToken)
```

In tests, the session is created with both `auth` and `_csrf` fields (see `app/test-utils.ts`):

```typescript
let session = createSession<{ auth: { userId: number }; _csrf: string }>()
session.set('auth', { userId })
session.set('_csrf', csrfToken)
```

## Related

- `concepts/csrf-implementation.md` — How CSRF middleware uses the session
- `guides/testing-with-csrf.md` — Testing authenticated sessions
- `../../auth/concepts/session-access.md` — Base session access patterns
- `../../auth/guides/auth-security.md` — Auth security checklist
