<!-- Context: project-intelligence/my_app/e2e-testing-architecture | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# E2E Testing Architecture

## Core Concept

Each e2e test starts a real HTTP server via `createTestServer()`, which wraps `router.fetch` in a Playwright-compatible `http.Server`. Tests use Playwright locators (`getByRole`, `getByLabel`, `getByText`) through `remix/test` and `remix/assert`.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│              test file (module scope)        │
│  await initializeAppDatabase()  ← runs once │
├─────────────────────────────────────────────┤
│  describe('feature') {                      │
│    it('does thing', async (t) => {          │
│      let page = await t.serve(server)       │
│      await page.goto('/path')               │
│      await page.getByRole(...).waitFor()    │
│    })                                       │
│  }                                          │
└─────────────────────────────────────────────┘
```

## Key Components

### `createTestServer()` (in `app/test-utils.ts`)
- Accepts `router.fetch` as a `(request: Request) => Response` handler
- Creates `http.createServer(createRequestListener(...))` bound to `127.0.0.1:0` (random port)
- Returns `{ baseUrl, close() }` for parallel test safety
- Each test gets its own server via `t.serve()`

### Database Initialization
- `initializeAppDatabase()` is called at **module scope** (not inside `before()`)
- Uses a cached promise pattern — idempotent, runs exactly once per process
- Creates tables (users, messages, lists, chatlog) and seeds test users (admin, customer)
- `postgresql://postgres:postgres@localhost:5432/my_app` default connection

### `remix-test.config.ts`
- Chromium only, 5s navigation/action timeouts

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Real HTTP server | Playwright needs a real server; `router.fetch` alone is not enough for Playwright |
| Random port (0) | Prevents port collisions when tests run in parallel |
| DB at module scope | Tables created once, seed happens if empty — safe for repeated runs |
| `waitUntil: 'load'` for SSE pages | Frames/SSE keep connections open; `networkidle` never resolves |
| Per-domain files | Auth tests in `auth.test.e2e.ts`, admin in `admin.test.e2e.ts` |
| No global test state | Each test creates its own Playwright browser context via `t.serve()` |

## Test Server Lifecycle

1. `createTestServer(router.fetch)` — starts listening on random port
2. `t.serve(server)` — creates Playwright page bound to that server
3. Test navigates and interacts via Playwright locators
4. Server closes when test finishes (managed by test runner)

## Codebase References

- Test utility: `my_app/app/test-utils.ts`
- Test config: `my_app/remix-test.config.ts`
- DB setup: `my_app/app/data/setup.ts`
- Router + middleware: `my_app/app/router.ts`
- Routes: `my_app/app/routes.ts`

## Related

- `guides/e2e-testing.md` — Step-by-step guide for writing tests
- `lookup/e2e-patterns.md` — Quick reference for credentials, locators
- `core/standards/concepts/test-coverage.md` — General testing standards
