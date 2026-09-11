---
name: remix3-playwright-browser-testing
description: "Use when a Playwright / `remix test` browser run hangs or times out, or a Remix 3 crash card hides the real exception — `networkidle` on SSE pages, unforgeable `window.location.reload()`, swallowed stacks."
metadata:
  origin: consolidated
---

# Playwright / Browser-Test Debugging for Remix 3

**Consolidated:** 2026-09-11
**Sources:** `remix3-playwright-sse-networkidle-hang` (2026-08-28), `chromium-window-location-reload-unforgeable` (2026-08-27), `playwright-capture-swallowed-exception-stack` (2026-08-30)

Three unrelated-looking symptoms of driving a Remix 3 page with a real browser: a navigation that never settles, a browser test that hangs forever, and a crash whose stack is invisible. Each has a distinct root cause and fix.

## Table of Contents

- [SSE pages: `networkidle` never settles](#sse-pages-networkidle-never-settles)
- [Browser tests: `window.location.reload()` is unforgeable](#browser-tests-windowlocationreload-is-unforgeable)
- [Crash cards: capture the swallowed exception stack](#crash-cards-capture-the-swallowed-exception-stack)
- [Pick the reproduction browser from the error message](#pick-the-reproduction-browser-from-the-error-message)
- [When to Use](#when-to-use)

## SSE pages: `networkidle` never settles

**Context:** Validating `/appointments/new` mobile UX with Playwright — `waitForLoadState('networkidle')` after navigation hung until the tool timeout, repeatedly.

Remix 3 pages serve a live `text/event-stream` channel (`/appointments/new/events` via the SSE `appointmentChannel`, plus chat, agent-events, and webhook-requests routes). The browser keeps the `EventSource` open indefinitely, so **`page.waitForLoadState('networkidle')` never resolves** — Playwright waits forever for zero in-flight requests. The same trap hits `Promise.all([waitForLoadState('networkidle'), click(...)])` after a navigate or submit.

Never use `networkidle` on a page (or after an action) that mounts an SSE/streaming connection. Wait on something that actually completes:

```js
// navigation — wait for a stable DOM anchor, not network idle
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('[data-appointments-table]', { timeout: 8000 })

// signed-in submit → redirect: wait for the URL to change
await page.fill('input[name="email"]', email)
await page.fill('input[name="password"]', pwd)
await page.click('button[type="submit"]')
await page.waitForURL((u) => u.pathname === '/' && !u.pathname.startsWith('/auth'), { timeout: 8000 })

// click that swaps the wizard panel
await page.waitForSelector('[data-wizard-form]', { timeout: 8000 })
```

- Pick a real state-specific DOM anchor (list wrapper `[data-appointments-table]`, wizard `[data-wizard-form]`, delete panel `[data-create-panel]`) instead of a timing heuristic.
- Add a short `waitForTimeout` only if a `clientEntry` effect (scrolling, toggling) must settle before you assert.

## Browser tests: `window.location.reload()` is unforgeable

**Context:** A Playwright/Chromium browser test (`*.test.browser.tsx`) hangs the whole suite with `Timed out waiting 90000ms for browser test progress (X/Y files completed)` after dispatching an event that triggers `window.location.reload()`.

`window.location.reload` (and `window.location` itself) is **unforgeable** in a real Chromium page: you cannot stub or override it, even in strict mode.

```js
// THROWS in real Chromium:
window.location.reload = () => {}            // TypeError: Cannot assign to read only property 'reload' of object '[object Location]'
Object.defineProperty(window.location, 'reload', { value: () => {} })  // same
Object.defineProperty(window, 'location', { value: fake })            // same
```

So a test that renders a component calling `window.location.reload()` (e.g. on an SSE `invalidate`/`navigate` event), then emits that event, **actually reloads the page**. The reload navigates the test context away while an `await` is pending, so the test never resolves and the runner hangs until timeout. It even works in jsdom-like harnesses where `window.EventSource` or other props are assignable — only the `Location` object is hardened.

Treat the window-mode reload as **not assertable in a real browser** and choose one of:

1. **Skip it** (fastest, no production change):
   ```js
   it.skip('invalidate event in window mode calls window.location.reload', async () => {
     // Skipped: window.location.reload is unforgeable in real Chromium, so
     // dispatching invalidate navigates the page away and hangs. Manual check only.
   })
   ```
2. **Add an injectable reload seam** to the component, so tests assert the call without navigating:
   ```js
   // component: `reload?.() ?? window.location.reload()`
   // test:     render with a spy reload, assert spy called once
   ```
3. **Assert a pre-reload side-effect** (skip-params early-return, a status flag set just before `reload()`), which is observable without navigation.

Note: **frame reload** (`frame.reload()`) is NOT a problem — only window-mode `window.location.reload()` navigates the top page. Keep frame-mode tests intact.

If a suite that previously "passed" as dormant `.tsx` browser tests starts hanging once you widen the test glob to include `.tsx`, run the file alone under an OS-level `timeout` to isolate the hanging test.

## Crash cards: capture the swallowed exception stack

**Context:** A client runtime catches render/DOM errors and renders its own error card — e.g. "Unexpected Error / Something went wrong / Node.insertBefore: Cannot insert a Text as a child of a Document". Playwright's `pageerror` and console listeners only ever see the *message*, never the stack, because the app's `try/catch` (or error-event handler) consumes the exception before it reaches the page.

Wrap the throwing DOM API in `page.addInitScript` (runs before any app code, re-applies on every document) with a `try/catch` that stashes the stack on `window`:

```ts
await page.addInitScript(() => {
  const orig = (Node.prototype as any).insertBefore
  ;(Node.prototype as any).insertBefore = function (node: Node, child: Node | null) {
    try {
      return orig.call(this, node, child)
    } catch (e: any) {
      ;(window as any).__ibStack = e.stack
      ;(window as any).__ibParent = this.nodeName
      ;(window as any).__ibNode = node.nodeName
      throw e
    }
  }
})
```

Drive the app until the error card shows, then read the captured stack:

```ts
console.log(await page.evaluate(() => (window as any).__ibStack))
```

Notes from the real case (Remix 3 client runtime, 2026-08-30):

- Wrapping **one method** is enough if the error message names it (`Node.insertBefore` → wrap `Node.prototype.insertBefore`). When the throwing API is unknown, cheaply wrap the usual suspects (`insertBefore`, `appendChild`, `removeChild`) in one init script.
- Capturing `this.nodeName` / `node.nodeName` alongside the stack answers "inserted **what** into **where**" (`#text` into `#document`) without re-deriving it from frames.
- This works because the crash card replaces content client-side without a navigation, so `window` state survives. If the failure *does* navigate, write to `sessionStorage` instead of `window` inside the wrapper — it survives same-origin navigations while `addInitScript` re-arms each document.
- The captured stack shows the *full async chain* — in the real case it revealed the trigger was an SSE `invalidate` listener → `window.location.reload()` → a Navigation-API interception → frame reload → stream diff, none of which was guessable from the message.

## Pick the reproduction browser from the error message

DOMException `message` strings are browser-specific. A user report without a browser name tells you which engine to reproduce in:

- Firefox style: `Node.insertBefore: Cannot insert a Text as a child of a Document`
- Chromium style: `Failed to execute 'insertBefore' on 'Node': ...`

In the source case, **Chromium silently tolerated the malformed diff** (only a 404 console warning) while **Firefox threw** — reproduce in the engine whose message format matches the report, or you may chase a crash that doesn't happen in your first-choice browser.

## When to Use

- A Playwright/e2e navigation or submit times out on a page that mounts an SSE/EventSource channel, or `networkidle` never settles.
- A browser test (`*.test.browser.tsx`) hangs ("Timed out waiting ... for browser test progress") after dispatching an event that triggers `window.location.reload()`; stubbing `window.location` throws "Cannot assign to read only property 'reload'".
- A browser app shows a generic "Unexpected Error / Something went wrong" card and `pageerror`/console capture yields only the message, never a stack.
- A crash report mentions a DOM API by name (`insertBefore`, `appendChild`, …) — wrap that prototype method and rerun.
- Deciding which browser to reproduce in: match the DOMException message style (Firefox vs Chromium wording) to the report.
