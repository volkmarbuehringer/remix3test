<!-- Context: project-intelligence/my_app/lookup/e2e-patterns | Priority: medium | Version: 1.0 | Updated: 2026-05-02 -->

# Lookup: E2E Testing Pattern Reference

## Test Users (Seeded by `initializeAppDatabase()`)

| Role | Email | Password | Used For |
|------|-------|----------|----------|
| Admin | `admin@myapp.com` | `admin123` | Admin dashboard, chat logs, lists |
| Customer | `user@myapp.com` | `password123` | Auth gates, messages, lists, chat |

## Route Test Patterns

| Goal | Pattern |
|------|---------|
| **Auth gate** | `goto` → `waitForURL('**/login**')` → verify login heading |
| **Authenticated view** | login first → `goto` → verify heading element |
| **Empty state** | `goto` → verify empty state heading/placeholder text |
| **Error banner** | `goto('?error=...')` → `getByText(...).waitFor()` |
| **Invalid form** | submit bad credentials → verify error message on same page |
| **Logout** | login → click Logout → verify Login link reappears |

## `waitUntil` Guidance

| Page Type | waitUntil | Reason |
|-----------|-----------|--------|
| Standard (home, login, register, chat, agent, lists) | `'networkidle'` | No persistent connections |
| SSE/Frame pages (messages) | `'load'` | SSE connection prevents `networkidle` |
| Admin (non-SSE) | `'networkidle'` | Standard pages |

## Common Locators

| Element | Locator |
|---------|---------|
| Page heading | `getByRole('heading', { name: '...' })` |
| Navigation links | `getByRole('link', { name: '...' })` |
| Form buttons | `getByRole('button', { name: '...' })` |
| Form inputs | `getByLabel('Email' / 'Password' / 'Name')` |
| Text content | `getByText('...')` or `getByText(/regex/)` |
| Nested elements | `getByLabel('Breadcrumb').getByText('Lists')` |

## Auth Locator Reference

| State | Visible Links | Hidden Links |
|-------|---------------|--------------|
| Unauthenticated | Home, Login, Register | Messages, Lists, Chat, Agent |
| Customer | Home, Messages, Lists, Chat, Agent | Login, Register, Admin |
| Admin | Home, Messages, Lists, Chat, Agent, Admin | Login, Register |

## Key Files

| File | Purpose |
|------|---------|
| `app/test-utils.ts` | `createTestServer()` — wraps `router.fetch` in real HTTP server |
| `app/router.ts` | Router with middleware stack; exports `router` |
| `app/data/setup.ts` | `initializeAppDatabase()` — DB + seed data |
| `app/routes.ts` | All route definitions |
| `remix-test.config.ts` | Playwright config (chromium, 5s timeouts) |

## Related

- `concepts/e2e-testing-architecture.md` — Architecture overview
- `guides/e2e-testing.md` — Step-by-step writing guide
- `core/standards/concepts/test-coverage.md` — General testing standards
