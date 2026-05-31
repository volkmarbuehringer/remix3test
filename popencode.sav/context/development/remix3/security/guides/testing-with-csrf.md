<!-- Context: development/remix3/security/guides/testing-with-csrf | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Testing with CSRF

**Purpose**: When `csrf()` middleware is active, every POST/PUT/DELETE/PATCH request must include a valid CSRF token. Use these helpers to either (a) extract a fresh token from a GET response, or (b) pre-create an authenticated session with an embedded token.

## Quick Reference

| Helper | Use Case | Returns |
|--------|----------|---------|
| `createCsrfSession(url)` | Public endpoints (login, register) | `{ cookie, csrfToken }` |
| `createAuthCookieWithCsrf()` | Authenticated endpoints (any user) | `{ cookie, csrfToken } \| null` |
| `createAuthCookieWithCsrfForUser(email)` | Specific user roles (admin, customer) | `{ cookie, csrfToken } \| null` |

## Helpers (app/test-utils.ts)

### createCsrfSession(url)

Performs a GET to extract session cookie + CSRF token from the SSR-rendered `<input name="_csrf">`:

```typescript
let { cookie, csrfToken } = await createCsrfSession(`${BASE}/login`)

let response = await router.fetch(`${BASE}/login`, {
  method: 'POST',
  headers: { Cookie: cookie },
  body: new URLSearchParams({ email: 'admin@newapp.com', password: 'admin123', _csrf: csrfToken }),
  redirect: 'manual',
})
```

### createAuthCookieWithCsrf()

Creates an authenticated session with embedded CSRF token. Looks up the first user:

```typescript
let session = await createAuthCookieWithCsrf()
if (!session) throw new Error('Failed to create auth session')

let formData = new FormData()
formData.set('content', 'Test message')
formData.set('_csrf', session.csrfToken)

let response = await router.fetch(ADMIN_MESSAGES_URL, {
  method: 'POST',
  headers: { Cookie: session.cookie },
  body: formData,
})
```

### createAuthCookieWithCsrfForUser(email)

Targets a specific user by email for role-based tests:

```typescript
let adminSession = await createAuthCookieWithCsrfForUser('admin@newapp.com')
let userSession = await createAuthCookieWithCsrfForUser('user@newapp.com')
```

## Pattern: Role-Based Access Tests

```typescript
it('blocks non-admin users', async () => {
  let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
  let response = await router.fetch(ADMIN_MESSAGES_URL, {
    headers: { Cookie: userResult!.cookie },
  })
  assert.equal(response.status, 403)
})
```

## Common Pitfalls

- ❌ **Missing CSRF token**: Returns 403. Always include `_csrf` in POST bodies.
- ❌ **Mismatched cookie/token**: CSRF token is bound to the session — mixing from different sessions = 403.
- ❌ **Token from wrong page**: `createCsrfSession` extracts the token from the GET response page. Ensure that page contains a form with `name="_csrf"`.
- ❌ **FormData vs URLSearchParams**: Use `FormData` for file uploads; `URLSearchParams` for simple text fields.

## Related

- `concepts/csrf-implementation.md` — How CSRF middleware works
- `concepts/session-security.md` — Session regeneration pattern
- `../../errors/csrf-middleware-gotchas.md` — Common CSRF pitfalls
