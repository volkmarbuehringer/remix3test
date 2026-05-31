<!-- Context: project-intelligence/checker/errors/common-login-errors | Priority: medium | Version: 1.0 | Updated: 2026-04-17 -->

# Common Login Errors

## Error: "Cannot find module '@remix-run/cookie'"

**Cause**: Using wrong import path.

**Fix**: Use `remix/*` not `@remix-run/*`:

```typescript
// ❌ Wrong
import { createCookie } from '@remix-run/cookie'

// ✅ Correct
import { createCookie } from 'remix/cookie'
```

**Reference**: `lookup/import-conventions.md`

---

## Error: "Database is not available in context"

**Cause**: Middleware order wrong - Auth before Database.

**Fix**: Database must come before Auth:

```typescript
// ❌ Wrong
middleware: [loadAuth(), loadDatabase()]

// ✅ Correct
middleware: [
  formData(),
  session(sessionCookie, sessionStorage),
  loadDatabase(),  // ← First
  loadAuth(),      // ← Second
]
```

---

## Error: "requireAuth() redirects in tests"

**Cause**: SKIP_AUTH not set in test environment.

**Fix**: Set SKIP_AUTH in test script:

```json
{
  "scripts": {
    "test": "SKIP_AUTH=true node --test './app/**/*.test.ts'"
  }
}
```

**Reference**: `guides/testing-with-skip-auth.md`

---

## Error: "Session not persisting after login"

**Cause**: Missing `await session.regenerateId()`.

**Fix**: Always regenerate on login:

```typescript
// Login success
await session.regenerateId(true)  // ← Required
session.set('auth', { userId: user.id })
```

---

## Error: "Open redirect vulnerability"

**Cause**: returnTo not validated.

**Fix**: Validate returnTo parameter:

```typescript
function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//')) {
    return undefined  // Reject absolute URLs
  }
  return returnTo
}
```

---

## Error: "User enumeration via error messages"

**Cause**: Different errors for "user not found" vs "wrong password".

**Fix**: Use generic message:

```typescript
// ❌ Wrong - reveals which failed
if (!user) return error('User not found')
if (!validPassword) return error('Invalid password')

// ✅ Correct - generic message
if (!user || !validPassword) {
  return error('Invalid email or password')
}
```

## 📂 Codebase References

**Implementation:**
- `checker/app/middleware/auth.ts` - getSafeReturnTo() validation
- `checker/app/controllers/auth/login/controller.tsx` - Generic error handling
- `checker/app/middleware/session.ts` - Session configuration

## Related

- `guides/login-implementation.md` - Implementation guide
- `lookup/import-conventions.md` - Import rules
