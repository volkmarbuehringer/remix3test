<!-- Context: project-intelligence/my_app/guides/e2e-testing | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Guide: E2E Testing

**Purpose**: How to write and run Playwright-based e2e tests for my_app.

## Prerequisites

- PostgreSQL running locally (`postgresql://postgres:postgres@localhost:5432/my_app`)
- Node.js test runner (`remix/test`, `remix/assert`)

## Running Tests

```sh
npm test                              # All tests (unit + e2e)
node --test app/auth.test.e2e.ts              # Single file
node --test --watch app/auth.test.e2e.ts       # Watch mode
```

Tests co-located in `app/` — `*.test.e2e.ts` naming.

## Test Setup Template

```typescript
import { describe, it } from 'remix/test'
import { createTestServer } from './test-utils.ts'
import { router } from './router.ts'
import { initializeAppDatabase } from './data/setup.ts'

await initializeAppDatabase()  // Module scope — runs once per process

describe('feature', () => {
  it('does something', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto('/path', { waitUntil: 'networkidle' })
    // ... assertions
  })
})
```

## Navigation

| Page Type | `waitUntil` | Reason |
|-----------|-------------|--------|
| Standard (home, login, lists, chat, agent) | `'networkidle'` | No persistent connections |
| SSE/Frame pages (messages) | `'load'` | SSE prevents `networkidle` |
| After form submit/redirect | `page.waitForURL('**/target**')` | Glob pattern for redirect target |

## Auth Patterns

```typescript
// Login existing user
await page.getByLabel('Email').fill('user@myapp.com')
await page.getByLabel('Password').fill('password123')
await page.getByRole('button', { name: 'Login' }).click()
await page.waitForURL('**/')

// Register unique user (avoid unique constraint violation)
let uniqueEmail = `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`

// Auth gate test
await page.goto('/protected-route', { waitUntil: 'networkidle' })
await page.waitForURL('**/login**')
await page.getByRole('heading', { name: 'Login' }).waitFor()

// Logout
await page.getByRole('button', { name: 'Logout' }).click()
await page.getByRole('link', { name: 'Login' }).waitFor()  // Login reappears
```

## Locator Patterns

```typescript
// Preferred (most reliable first)
getByRole('heading', { name: 'Dashboard' })   // Semantic roles
getByRole('link', { name: 'Home' })            // Nav links
getByRole('button', { name: 'Login' })         // Buttons
getByLabel('Email')                             // Form inputs
getByText('Welcome to')                         // Text fallback
getByLabel('Breadcrumb').getByText('Lists')     // Chained locators

// Assert element absence (use remix/assert — import only when used)
import * as assert from 'remix/assert'
assert.equal(await page.getByRole('link', { name: 'Login' }).count(), 0)
```

## Error State Patterns

```typescript
// Error banner from query param (chat)
await page.goto('/chat?error=Something+went+wrong', { waitUntil: 'networkidle' })
await page.getByText('Something went wrong').waitFor()

// Invalid login
await page.getByLabel('Email').fill('wrong@example.com')
await page.getByRole('button', { name: 'Login' }).click()
await page.getByText('Invalid email or password').waitFor()
```

## Test Files

| File | Tests |
|------|-------|
| `app/home.test.e2e.ts` | Page load, nav links, footer |
| `app/auth.test.e2e.ts` | Login, register, logout, invalid |
| `app/messages.test.e2e.ts` | Auth gate, authenticated view |
| `app/lists.test.e2e.ts` | Auth gate, breadcrumb |
| `app/chat.test.e2e.ts` | Empty state, error banner |
| `app/agent.test.e2e.ts` | Empty state |
| `app/admin.test.e2e.ts` | Auth gates, dashboard, chat logs, lists |

## Common Gotchas

- **SSE pages**: Use `waitUntil: 'load'` — SSE connections prevent `networkidle`
- **Unique emails**: Use `Date.now()` + random suffix for register tests to avoid unique constraint violations
- **assert import**: Only import `remix/assert` when `assert.equal()` is used; unused import causes lint error
- **Session isolation**: Each `t.serve()` creates a fresh browser context — cookies not shared
- **Random ports**: Port 0 binding means capture `baseUrl` from server promise result

## Codebase References

- Test utility: `my_app/app/test-utils.ts`
- All e2e tests: `my_app/app/*.test.e2e.ts`
- Test config: `my_app/remix-test.config.ts`
- DB setup: `my_app/app/data/setup.ts`

## Related

- `concepts/e2e-testing-architecture.md` — Architecture and design decisions
- `lookup/e2e-patterns.md` — Quick reference for credentials, locators
- `core/standards/concepts/test-coverage.md` — General testing standards
