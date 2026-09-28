---
name: remix3-testing
description: "Use when writing or debugging a Remix 3 test suite — clientEntry DOM side effects that render/act cannot drive, parallel-test interference despite ephemeral DBs, waitFor on a statically present element, mocking an external HTTP service on a dynamic port, HTML-escaped assertions on rendered markup, and this app's harness for state isolation and `t.serve` e2e wiring, and Playwright/browser-run hangs (`networkidle` on SSE pages, unforgeable `window.location` navigation, crash cards that hide the stack)."
user-invocable: false
origin: consolidated
---

# Remix 3 Testing

**Consolidated from:** `remix3-cliententry-browser-test-stubs`, `remix-test-parallel-interference`, `static-element-waitfor-content-not-existence`, `mock-http-external-service-dynamic-port`, `remix3-html-amp-escaped-assertions`, `remix3-playwright-browser-testing`

This skill is the **index** for Remix 3 test-suite deltas. For the vendor test runner API (`remix test`, `describe`/`it`, `render`/`act`), use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`). For the canonical test boundaries and patterns (`router.fetch`, state isolation, browser component and e2e flows), use the installed testing guide `node_modules/remix/guides/13-testing.md`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A `*.test.browser.tsx` must assert a `clientEntry` side effect driven by `getBoundingClientRect`, `matchMedia`, or `scrollTo` that `render`/`act` alone cannot drive | `references/cliententry-browser-test-stubs.md` |
| Parallel tests interfere despite ephemeral per-run DBs; a test passes in isolation but fails in the full suite; a shared-DB test fails even alone (`LIMIT 1` without `ORDER BY`, seed rows relative to today); another suite's unscoped `afterEach` `DELETE` removed your live fixture; a background retention/cleanup timer swept the old row your test just inserted | `references/parallel-test-interference.md` |
| `waitFor(() => !!getElementById(x))` passes instantly and the next assertion fails on empty content | `references/waitfor-static-element.md` |
| Mocking an external HTTP service in a test; the real service is running locally on the same port (`EADDRINUSE`) | `references/mock-external-http-service.md` |
| A `remix test` string assertion on an `href`/`action`/query string fails because the HTML escapes `&` to `&amp;` | `references/html-amp-escaped-assertions.md` |
| A router test shares session/DB state, or an `*.test.e2e.ts` needs `t.serve`/`createTestServer` wiring (the guide's generic `createAppRouter`/memory-storage examples don't match this app) | `references/state-isolation-and-e2e-serve.md` |
| A Playwright navigation/submit hangs on a page that mounts an SSE/EventSource channel (`networkidle` never settles) | `references/sse-networkidle-never-settles.md` |
| A `*.test.browser.tsx` hangs after code calls `window.location.reload()`/`assign`/`replace`/`href` | `references/location-reload-unforgeable.md` |
| A generic crash card hides the real exception stack from `pageerror`/console | `references/crash-card-swallowed-stack.md` |
| Choosing which browser engine to reproduce a DOMException report in | `references/reproduction-browser-from-message.md` |

## Core Rules

**clientEntry browser-test stubs (`references/cliententry-browser-test-stubs.md`)**

- `render(...)` + `result.act(...)` flushes `handle.queueTask` and is enough for event-driven entries, but **not** when the side effect depends on geometry or media state (`getBoundingClientRect().top < 0`, `window.matchMedia(...)`, `scrollTo`/`scrollIntoView` in a container with no real layout).
- Build a controlled DOM fixture the entry queries, then stub the platform APIs with `Object.defineProperty(el, 'scrollTo'|'scrollHeight'|'clientHeight', { configurable: true })` (preferred over assignment: the properties are inherited/read-only and `scrollTo` is overloaded, so a plain assignment needs an `as unknown as` cast); stub `matchMedia` per test and restore it in `afterEach`.
- Pair every "not called" case with a positive case that proves the entry ran — a stub that is never called makes an "assert zero calls" test pass vacuously. Module-scoped delegated listeners outlive a test, so scope queries to `result.container` and remove fixtures in `afterEach` even when an assertion throws.
- Run explicitly with `NODE_ENV=test npx remix test app/ui/<name>.test.browser.tsx` to execute every configured project (here `chromium` + `firefox`); for the production counterpart (once per frame navigation, keyed on a server-rendered `data-*` attribute + `handle.queueTask`) see `remix3-frame-cliententry`.

**Parallel test interference (`references/parallel-test-interference.md`)**

- Ephemeral per-run databases do **not** fix within-run interference: parallel workers' `setupTestEnvironment()` data accumulates in the shared ephemeral DB, so when seed + helper + own + parallel data exceeds a paginated page size the test's own rows fall off the first page. Diagnose by isolation, then keep `after()` cleanup for colliding sources, raise the page size in the test environment, or scope assertions to unique filters/identifiers.
- A shared-DB test can also fail **in isolation** when the fixture is not self-owned: `LIMIT 1` without `ORDER BY` picks an arbitrary row, and seed rows relative to today (seeded weekday offerings) are excluded by a `day >= today` window on weekends. Create the rows the assertion needs, require the needed properties in the query (`JOIN … WHERE … ORDER BY`, throwing when empty), and scope to identifiers the test owns.
- A `forks` pool isolates **processes, not the database**: a teardown that deletes a whole shared table (`DELETE FROM chat_runs` with no `WHERE`) can land inside a parallel suite's insert→assert window and null its fixture. Resolve the ids your suite authenticates as once, and scope every delete to them (`WHERE user_id = ANY($1::int[])`).
- A **background timer started from shared init** (`initializeAppDatabase()` → `startDatabaseMaintenance()` → `setInterval` that runs immediately) executes in every worker and can delete the old row a test just inserted before the test's own call. Guard the start with `process.env.NODE_ENV !== 'test'`; keep the sweep functions unit-tested against explicit windows.

**Static container and `waitFor` (`references/waitfor-static-element.md`)**

- An existence-check wait (`!!getElementById(x)`) passes instantly once the element is **statically present** (a node refactored from dynamically-created into a fixed fixture/placeholder); the following `textContent` assertion then fails with a confusing "not found" on the empty shell.
- Make the `waitFor` predicate overlap the assertion: if you assert on `textContent`, wait on `textContent` (e.g. `!!gate && gate.textContent?.includes('Cancel Jane Doe?')`).

**Mock external HTTP service (`references/mock-external-http-service.md`)**

- Bind the mock with `node:http` `createServer` on **port 0** (OS-assigned) to avoid `EADDRINUSE` with a real local service, and read the target URL through a **function** evaluated at request time (`function externalUrl() { return process.env.EXTERNAL_URL ?? ... }`) — a module-level `const` is evaluated at import, before `before()` can override it, and the test then silently skips the external-forwarding path.
- In `before()` set `process.env.EXTERNAL_URL` from `mockServer.address()` once listening; in `after()` call `mockServer?.close()` and `delete process.env.EXTERNAL_URL` so other tests are unaffected. Verify the forward actually happened via a side effect (e.g. the stored response status in the DB), not just a 2xx.

**HTML-escaped assertions (`references/html-amp-escaped-assertions.md`)**

- Rendered HTML serializes `&` in attribute values as `&amp;` (and `"` as `&quot;`), and `response.text()` returns that serialized HTML with entities intact — so a string assertion written with the raw `&` never matches and fails with no hint of the cause. Match the escaped form in `response.text()`, including in absence assertions.
- Prefer asserting on a redirect `Location` header when possible: headers are not HTML-escaped and keep the raw `&`.

**State isolation and `t.serve` e2e (`references/state-isolation-and-e2e-serve.md`)**

- The guide's generic seams are app-specific here: the factory is `createNewappRouter(options)` in `app/router.ts` (not `createAppRouter`), shared tests import `router` from `app/test-router.ts`, DB state is an ephemeral Postgres database created by `test/setup.ts` via `remix.json` `test.setup` (not SQLite `:memory:`), and session/cookie helpers already exist in `app/test-utils.ts` (`extractCookie`, `createCsrfSession`, `createAuthCookieWithCsrf*`) instead of a hand-rolled `getResponseCookie`.
- E2E uses `t.serve(await createTestServer((request) => router.fetch(request)))` (arrow adapter, not `createTestServer(router.fetch)`); `t.serve` closes the server/page, but DB/file fixtures created outside it need their own cleanup, and Firefox-broken assertions are scoped with `isFirefox(page)` rather than skipped.
- The ephemeral DB is per-run, not per-test: parallel workers accumulate rows, so a test that paginates still owns its cleanup (see `parallel-test-interference.md`).

**Playwright / browser-run debugging (`references/sse-networkidle-never-settles.md`, `references/location-reload-unforgeable.md`, `references/crash-card-swallowed-stack.md`, `references/reproduction-browser-from-message.md`)**

- **Never use `networkidle`** on a page/action that mounts an SSE/streaming connection — the open `EventSource` keeps `waitForLoadState('networkidle')` pending forever. Wait on a state-specific DOM anchor; use `waitForURL` for a signed-in submit→redirect; add a short `waitForTimeout` only if a `clientEntry` effect must settle.
- `window.location.reload`/`location` are unforgeable in real Chromium (assigning or `Object.defineProperty`-ing throws `TypeError: Cannot assign to read only property 'reload' of object '[object Location]'`), and **any** `Location` navigation (`reload`/`assign`/`replace`/`href`) triggered while an `await` is pending navigates the test page away — the runner reports no progress (`0/N files completed`) and hangs. Window-mode navigation is **not assertable** in a real browser: skip it, add an injectable reload seam, assert a pre-reload side effect, or extract a pure predicate. `frame.reload()` is fine. If a dormant suite starts hanging after widening the glob to `.tsx`, run the file alone under an OS-level `timeout`.
- **Crash cards swallow the stack**: the app's `try/catch` consumes the exception before Playwright sees it. Wrap the throwing DOM method in `page.addInitScript` (runs before app code, re-arms per document) and stash the stack on `window` (or `sessionStorage` when the failure navigates); wrap **one** named method (`Node.insertBefore`) or the usual `insertBefore`/`appendChild`/`removeChild`, and capture `this.nodeName`/`node.nodeName`.
- **DOMException messages are browser-specific** (Firefox `Node.insertBefore: Cannot insert a Text as a child of a Document` vs Chromium `Failed to execute 'insertBefore' on 'Node': …`): reproduce in the engine whose wording matches the report.

## When to Use

- You are writing or debugging a Remix 3 `remix test` suite (server-render or `*.test.browser.tsx`) and an assertion fails for a reason the test code does not explain.
- A browser test must drive a measurement/geometry/media-driven `clientEntry` side effect that `render`/`act` cannot reach.
- Tests interfere when run in parallel, or a shared-DB test fails intermittently or even in isolation.
- A `waitFor` existence check passes but the content assertion that follows fails.
- You need to mock an external HTTP service or match escaped markup in rendered output.
- A router test needs an authenticated session or multi-request flow, or you are adding an `*.test.e2e.ts`, and the guide's generic example does not match this repo's harness.
- A Playwright/e2e navigation or submit hangs on a page with an SSE/EventSource channel, or a browser test hangs after a `window.location` navigation.
- A crash card hides the real exception stack from `pageerror`/console capture.

## Related Skills

- `remix3-frame-cliententry` — production `Frame` navigation and `clientEntry` side effects (`handle.queueTask`, `data-*` identity)
- `remix3-bun-runtime` — running the app and its `remix test` suite under Bun
- `remix3-css-and-layout` — styling/layout deltas that browser tests assert on (geometry, computed style)
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix test` runner and `render`/`act` API
