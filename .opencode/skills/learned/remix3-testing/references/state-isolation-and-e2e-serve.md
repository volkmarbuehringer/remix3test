# Remix 3 Test State Isolation and `t.serve` E2E Wiring

**Source:** App harness; primary API reference is the installed testing guide `node_modules/remix/guides/13-testing.md` — "Isolate stateful app tests" (L157–206) and "Test complete flows end to end" (L281–368).

**Extracted:** 2026-09-26

**Context:** Writing a `remix test` server/router test that shares session or database state, or an `*.test.e2e.ts` that drives the app through Playwright.

## Problem

The guide describes the *shape* of the seams to use — a `createAppRouter(options)` factory, memory-backed session/DB/file storage, a `getResponseCookie` helper, and `createTestServer(router.fetch)` + `t.serve(...)`. This app already implements those seams under different names and on Postgres, so copying the guide's examples verbatim creates a second, divergent harness alongside the one every existing test uses.

## Solution

Use the guide for the pattern; use these app-owned modules for the implementation.

**Router factory (the guide's `createAppRouter`)**

- `app/router.ts` exports `createNewappRouter(options?: { sessionCookie?: Cookie; sessionStorage?: SessionStorage })` — the production composition root, deliberately factory-only.
- Router tests import the shared instance from `app/test-router.ts` (`export const router = createNewappRouter()`, built once at module-eval), not a singleton from `app/router.ts`. This is the module boundary the guide recommends, just app-named.
- For per-test session isolation (the guide's memory-session recipe), pass the seam into the factory — `createNewappRouter({ sessionStorage: createMemorySessionStorage() })` — rather than mutating module state. The shared `app/test-router.ts` instance is the default when a suite only reads session state.

**Database state (the guide's SQLite `:memory:` recipe does not apply here)**

- This app is Postgres. `remix.json` wires `test.setup` to `test/setup.ts`: `globalSetup` creates a fresh `newapp_test_<timestamp>_<pid>` database, rewrites `DATABASE_URL`, resets the schema, and runs `initializeAppDatabase()`; `globalTeardown` closes the pool and drops the database.
- Tests reach the DB through the pool in `app/data/test-pool.ts`; per-suite `setupTestEnvironment()` / `teardownTestEnvironment()` helpers live in `app/actions/verwaltung/controller.test-utils.ts`. Rows a test creates still need its own cleanup — the ephemeral DB only bounds it per run, not per test (see `parallel-test-interference.md`).

**Cookie round-trip (the guide's `getResponseCookie`)**

`app/test-utils.ts` already provides what the guide builds by hand:

- `extractCookie(response)` — parses `Set-Cookie` with `SetCookie.from` (`remix/headers`) and returns `name=value`; not hard-coded to the `session=` prefix the guide's helper searches for.
- `createCsrfSession(url)` — GET, then extract the session cookie and the `_csrf` token from the rendered form.
- `createAuthCookieWithCsrf()` / `createAuthCookieWithCsrfForUser(email)` — mint an authenticated session cookie directly, skipping the GET + token-extraction round-trip.

Send them the same way as the guide: `router.fetch(url, { headers: { Cookie: adminCookie } })`.

**End-to-end (`t.serve` + `createTestServer`)**

- The app form uses an arrow adapter, not the guide's direct reference: `let page = await t.serve(await createTestServer((request) => router.fetch(request)))`. Every existing `*.test.e2e.ts` (e.g. `app/actions/lists/lists-client-ops.test.e2e.ts`, `app/actions/agent-events/agent-events-frame-redirect.test.e2e.ts`) uses this.
- `t.serve(...)` closes the server and page after the test; database or file fixtures created outside it still need their own cleanup.
- Both configured projects (chromium + firefox) run every e2e file. Scope an assertion that Firefox cannot satisfy with `isFirefox(page)` from `app/test-utils.ts` rather than skipping the project, so the page-load smoke coverage survives.

## When to Use

- A router test needs an authenticated request or a multi-request session flow, and you are about to hand-roll a `Set-Cookie` parser.
- A test mutates session or DB state and you need per-test isolation beyond the per-run ephemeral database.
- You are adding an `*.test.e2e.ts` and need this app's `t.serve` / `createTestServer` wiring.
- The guide's `createAppRouter` / `getResponseCookie` / SQLite examples do not match this repo and you are tempted to add them alongside the real harness.
