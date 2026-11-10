# Test Harness Gotchas (Playwright, browser tests, HTTP mocks)

**Source:** consolidated from `remix3-playwright-sse-networkidle-hang`, `chromium-window-location-reload-unforgeable`, `select-change-events`, `static-element-waitfor-content-not-existence`, `mock-http-external-service-dynamic-port`, `playwright-capture-swallowed-exception-stack`, `remix-test-coverage-flag-forwarding`, `home-nav-hydration-e2e-flake`

**Extracted:** 2026-06-23 … 2026-11-09
**Context:** Cross-cutting failures in this app's `remix test` browser/e2e suites. For Remix-specific wiring see `state-isolation-and-e2e-serve.md` and `cliententry-browser-tests.md`.

## `networkidle` never settles on SSE pages

Remix 3 pages mount live `text/event-stream` channels (`/appointments/new/events` plus chat, agent-events, and webhook-requests routes). The browser keeps the `EventSource` open, so `page.waitForLoadState('networkidle')` waits forever for zero in-flight requests. The same trap hits `Promise.all([waitForLoadState('networkidle'), click(...)])`.

Never use `networkidle` on a page (or after an action) that mounts an SSE/streaming connection. Wait on state that completes:

```js
// navigation — stable DOM anchor
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('[data-appointments-table]', { timeout: 8000 })

// signed-in submit → redirect: wait for the URL
await page.click('button[type="submit"]')
await page.waitForURL((u) => u.pathname === '/' && !u.pathname.startsWith('/auth'), { timeout: 8000 })

// click that swaps the wizard panel
await page.waitForSelector('[data-wizard-form]', { timeout: 8000 })
```

Pick a real state-specific anchor (`[data-appointments-table]`, `[data-wizard-form]`, `[data-create-panel]`). Add a short `waitForTimeout` only if a `clientEntry` effect (scroll, toggle) must settle before the assertion.

## `window.location` navigation is unforgeable

`window.location.reload` (and `window.location` itself) cannot be stubbed in real Chromium:

```js
window.location.reload = () => {}                         // TypeError: read only
Object.defineProperty(window.location, 'reload', {...})   // same
Object.defineProperty(window, 'location', {...})          // same
```

A test that renders a component calling `window.location.reload()` (e.g. on an SSE `invalidate`) **actually reloads the page**; the pending `await` never resolves and the runner hangs with `Timed out waiting 90000ms for browser test progress`. The same applies to `location.assign`, `location.replace`, and `location.href = ...`, including helpers that navigate on the caller's behalf. Even jsdom-like harnesses where other `window` props are assignable cannot replace `Location` — only that object is hardened.

Treat window-mode navigation as **not assertable in a real browser** and choose one of:

1. **Skip it** — no production change; document why.
2. **Add an injectable reload seam** (`reload?.() ?? window.location.reload()`) and assert the spy.
3. **Assert a pre-reload side-effect** (status flag, skip-params early return).
4. **Extract a pure predicate** — e.g. `isSameOriginFrameSource(url)` for a resolver guard that would otherwise call `location.assign`; assert the predicate and that `fetch` was not called.

**Frame reload** (`frame.reload()`) is not a problem — only window-mode navigation leaves the test page.

If a dormant `.tsx` browser test starts hanging after the glob widens, run that file alone under an OS-level `timeout` to isolate it.

## Native `<select>` change events

- `page.selectOption()` fires the remix `on('change')` handler in **Chromium**, but **not Firefox**.
- A synthetic `sel.dispatchEvent(new Event('change', { bubbles: true }))` after `sel.value = 'az'` reaches a raw `addEventListener('change')` but **not** the remix mixin handler in Chromium. The mixin attaches via `addEventListener` with no `isTrusted` gate, so do not assume equivalence on selects.
- The identical synthetic dispatch **does** reach handlers on `<input type="checkbox">`; host element type matters.
- Keyboard ArrowDown/typeahead on a closed dropdown works in Chromium only.

Drive native selects with `page.selectOption` (Chromium), **retry until the DOM reflects the change** (the listener is attached by the client entry's render pass, so a click in the hydration gap is a silent no-op), and scope mutation assertions to Chromium with `isFirefox(page)` plus a render smoke check. Same pattern as `selectItems` in the lists e2e files. This is the same family as the documented `fill()`/`on('input')` gap and the hover-reveal pointer-event issue.

## Wait for content, not existence

Existence-check waits (`!!getElementById(x)`) break when an element changes from dynamically created to statically present in the fixture: the wait passes instantly on the empty shell, and the next `textContent` assertion fails.

Make the wait predicate overlap the assertion:

```ts
await waitFor(() => {
  let gate = document.getElementById('ae-confirm-gate')
  return !!gate && gate.textContent?.includes('Cancel Jane Doe?')
})
```

If you assert on `textContent`, wait on `textContent`.

## Wait for the destination, not any matching element

After a navigation click, `page.locator('main h1').first().waitFor()` can resolve on the **source**
page — the login page has an `h1` too — so the test starts interacting while the destination
document is still replacing the source. This made `home-nav-responsive.test.e2e.ts` flake (2/10
runs) under load: the drawer opened on the outgoing page, then the home document replaced it, or
the click landed before `NavToggle` had hydrated.

Wait for the destination URL instead, then for the client entry's hydration marker:

```ts
await page.waitForURL((url) => url.pathname === routes.home.href(), { timeout: 15_000 })
await page.locator('main h1').filter({ hasText: 'Verwaltung' }).first().waitFor({ timeout: 15_000 })
await page.locator('#nav-toggle[data-nav-toggle-ready]').waitFor({ timeout: 15_000 })
await page.locator('#nav-toggle').click()
```

The home-specific content wait matters: the URL can change while the outgoing header (and its stale readiness marker) is still mounted, so URL + marker alone still flaked. After waiting for the home hero plus hydration the test passed 10/10 Firefox runs.

`NavToggle` sets `data-nav-toggle-ready` when its delegated document listeners attach. It resolves
`#nav-toggle`/`#nav-drawer` by id on every event instead of capturing nodes, so a layout re-render
can replace either element without rebinding; the drawer's open state lives on the native
`<dialog>`, not in a mirrored class.

## Mock an external HTTP service on port 0

Two problems: the real service may already own the port (`EADDRINUSE`), and a module-level `const URL = process.env.X ?? 'default'` is evaluated at import time — too early for `before()` to override it, so the test silently skips the forwarding path.

Use a function-wrapped env read plus an OS-assigned port:

```ts
// controller: read at request time
function externalUrl(): string {
  return process.env.EXTERNAL_URL ?? 'http://127.0.0.1:8644/endpoint'
}
```

```ts
import { createServer } from 'node:http'

let mockServer: ReturnType<typeof createServer>

before(async () => {
  await new Promise<void>((resolve) => {
    mockServer = createServer((req, res) => {
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'accepted', delivery_id: 'test-123' }))
    })
    mockServer.listen(0, '127.0.0.1', () => {
      let addr = mockServer.address()
      if (addr && typeof addr === 'object') {
        process.env.EXTERNAL_URL = `http://127.0.0.1:${addr.port}/endpoint`
      }
      resolve()
    })
  })
})

after(async () => {
  mockServer?.close()
  delete process.env.EXTERNAL_URL
})
```

Verify the forward by its side effect (query the DB for the stored response status), not by a mock-side assertion alone.

## Pick the reproduction browser from the error message

`DOMException` messages are engine-specific. A report without a browser name still tells you where to reproduce:

- Firefox: `Node.insertBefore: Cannot insert a Text as a child of a Document`
- Chromium: `Failed to execute 'insertBefore' on 'Node': ...`

In the source case Chromium silently tolerated the malformed diff (only a 404 console warning) while Firefox threw — reproducing in the wrong engine chases a crash that does not happen there.

## `mockImplementationOnce` indexes are absolute, not "next pending"

The #12097 `.mock` controls on `t.mock.fn`/`t.mock.method` (preview release
`v0.20261110.182141-main-d488afb4`) number one-shot overrides by absolute call index. Consecutive
`mockImplementationOnce(impl)` calls made before any invocation both register at
the current call index (`calls.length`, still `0`), so the second silently
replaces the first and the next call falls through to the default. Pass the
zero-based index explicitly when queuing responses:

Observed symptom: the first call consumes the last-queued response, the first
response is never used, and a later call reaches the real/default implementation
(for example, a forecast payload parsed as a geocode result, surfacing as
`Location "…" not found`).

```ts
let fetchMock = t.mock.method(globalThis, 'fetch')
fetchMock.mock.mockImplementation(() => Promise.reject(new Error('unexpected')))
fetchMock.mock.mockImplementationOnce(geocode, 0)
fetchMock.mock.mockImplementationOnce(forecast, 1)
```

`t.mock.method(globalThis, 'fetch')` also restores the original method when the
test ends, so the manual `globalThis.fetch = original` try/finally is
unnecessary.

Vendor reference: `node_modules/remix/src/test/README.md` § "Mocks and Spies"
(the "defaults to the next call" wording means the current call index). Pair it
with `callCount()` to prove every queued request ran.

## Run coverage in one `remix test` invocation

`npm test -- --coverage` is broken twice over. npm appends script arguments to the end of the whole
`&&` chain, so the flag lands on the last command (`npm run test:e2e --coverage`) and npm 12
rejects it as an unknown CLI flag (`EUNKNOWNCONFIG: Unknown cli flag: --coverage`). Even after
forwarding, three separate `remix test` runs each write their own report: the CLI only combines
server, browser, and e2e maps inside one invocation (`allCoverageMaps` →
`generateCombinedCoverageReport`), so `.coverage` would end up containing just the last type.

Use the dedicated script, which runs all three types together:

```sh
npm run test:coverage
# rm -rf .coverage && NODE_ENV=test remix test \
#   --type server --type browser --type e2e --coverage --concurrency 2
```

The `rm -rf .coverage` is not cosmetic: `collectServerCoverageMap` reads every `coverage-*.json`
in the directory, and the vendor's cleanup is commented out, so raw V8 data from earlier runs
accumulates into the merged report.

One invocation also runs `test/setup.ts` once, so server, browser, and e2e share a single test
database (the separate `npm test` phases each get a fresh one). Tests that assume an empty DB fail
only in the combined run. Two real cases surfaced this: `lists copy`/`duplicate` e2e tests asserted
the sidebar row count grows, but the sidebar caps at 15 rows, so a new row replaces the last one —
match the copied row by title instead; and the target picker's search input shrank below its 44px
touch target once the unpaginated candidate list filled the dialog — `flexShrink: 0` +
`minHeight: 44px` on `targetPickerSearchStyle` fixed the layout.

The same npm argument placement explains why `npm test -- <glob>` only filters the e2e phase; use
`npm run test:server -- <glob>` (or `test:browser` / `test:e2e`) to target one type.

`test:coverage` is also the heaviest run in the repo (~23 min at `--concurrency 2`). On a loaded dev
machine the vendor's hardcoded 90s browser-progress timeout can fire during the Firefox browser
phase with `(0/59 files completed)`; that is a harness timeout, not a test failure (run
`npm run test:browser` standalone to confirm). Rerun on a quiet machine/CI. Browser-test coverage is
collected only for Chromium (`coverageEnabled = e2e.coverage && browserType() === 'chromium'`), so a
Firefox browser-phase timeout does not skew the report, but it still makes the command exit 1.

## When to Use

- A Playwright navigation/submit hangs on a page with an SSE/EventSource channel.
- A browser test hangs after code calls `window.location.reload()`/`assign`/`replace`/`href`.
- A remix `on('change')` handler on a native `<select>` does not fire under Playwright.
- A `waitFor` existence check passes instantly but the next content assertion fails.
- A handler calls an external HTTP service that may already be running locally.
- You need to choose Chromium vs Firefox from a DOMException report.
- You queue several `t.mock` one-shot implementations and only the last one runs.
- `npm test -- --coverage` exits with `EUNKNOWNCONFIG`, or a coverage report only reflects one type.
- A navigation e2e test flaps because a generic wait (`main h1`) resolves on the source page, or a client-entry click is a no-op before hydration.
