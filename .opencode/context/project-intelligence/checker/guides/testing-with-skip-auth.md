<!-- Context: project-intelligence/checker/guides/testing-with-skip-auth | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Testing with SKIP_AUTH

**Core Idea**: Split auth into `loadAuth()` (always runs) and `requireAuth()` (redirects). Use `SKIP_AUTH` env var to bypass redirects in tests.

## The Pattern

```typescript
// middleware/auth.ts
export function requireAuth(options?: RequireAuthOptions) {
  // In test mode, return no-op middleware
  if (process.env.SKIP_AUTH === 'true') {
    return async (_context, next) => next()
  }
  
  return requireAuthenticatedUser({
    onFailure(context) {
      return redirect('/login')
    },
  })
}
```

## Test Mode Detection

```typescript
// Auto-detects test mode
const isTestMode = process.env.SKIP_AUTH === 'true'
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "SKIP_AUTH=true node --test './app/**/*.test.ts'",
    "test:e2e": "playwright test"
  }
}
```

## Test Types

| Type | Auth | Command | Use Case |
|------|------|---------|----------|
| Unit | Skipped | `SKIP_AUTH=true pnpm test` | Test route logic |
| E2E | Real | `pnpm test:e2e` | Test full flows |

## Unit Test Example

```typescript
// SKIP_AUTH allows testing without login
const skipAuthTests = process.env.SKIP_AUTH === 'true'

describe('Account Controller', { skip: !skipAuthTests }, () => {
  it('returns user data', async () => {
    // Test runs without auth redirect
    let response = await fetch('/account')
    assert.strictEqual(response.status, 200)
  })
})
```

## Security Tests

Skip in unit tests, run in E2E:

```typescript
describe('Auth Redirects', { skip: skipAuthTests }, () => {
  it('redirects unauthenticated to login', async () => {
    let response = await fetch('/account')
    assert.strictEqual(response.status, 302)
    assert.ok(response.headers.get('location').includes('/login'))
  })
})
```

## Key Insight

> **Unit tests should test route logic, not auth logic.**
> 
> - Auth redirects → E2E tests (real auth flow)
> - Route logic → Unit tests (with SKIP_AUTH)

## 📂 Codebase References

**Implementation:**
- `checker/app/middleware/auth.ts` - SKIP_AUTH check in requireAuth()
- `checker/app/controllers/account/controller.tsx` - Protected route example

## Related

- `guides/login-implementation.md` - Auth implementation
- `concepts/middleware-composition.md` - Middleware patterns
