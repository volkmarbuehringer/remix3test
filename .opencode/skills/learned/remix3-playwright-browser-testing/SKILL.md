---
name: remix3-playwright-browser-testing
description: "Use when a Playwright / `remix test` browser run hangs or times out, or a Remix 3 crash card hides the real exception — `networkidle` on SSE pages, unforgeable `window.location` navigation (`reload`/`assign`), swallowed stacks."
metadata:
  origin: consolidated
---

# Playwright / Browser-Test Debugging for Remix 3

**Consolidated:** 2026-09-11
**Updated:** 2026-09-12 — generalized from `window.location.reload()` to any `Location` navigation (`assign`/`replace`/`href`).
**Sources:** `remix3-playwright-sse-networkidle-hang` (2026-08-28), `chromium-window-location-reload-unforgeable` (2026-08-27), `playwright-capture-swallowed-exception-stack` (2026-08-30)

Three unrelated-looking symptoms of driving a Remix 3 page with a real browser: a navigation that never settles, a browser test that hangs forever, and a crash whose stack is invisible. Each has a distinct root cause and fix.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A Playwright navigation/submit hangs on a page that mounts an SSE/EventSource channel (`networkidle` never settles) | `references/sse-networkidle-never-settles.md` |
| A `*.test.browser.tsx` hangs after code calls `window.location.reload()`/`assign`/`replace`/`href` | `references/location-reload-unforgeable.md` |
| A generic crash card hides the real exception stack from `pageerror`/console | `references/crash-card-swallowed-stack.md` |
| Choosing which browser engine to reproduce a DOMException report in | `references/reproduction-browser-from-message.md` |

## Core Rules

- **Never use `networkidle`** on a page or after an action that mounts an SSE/streaming connection — the open `EventSource` keeps `waitForLoadState('networkidle')` pending forever. Wait on a real state-specific DOM anchor instead; use `waitForURL` for a signed-in submit→redirect; add a short `waitForTimeout` only if a `clientEntry` effect (scrolling, toggling) must settle first.
- **`window.location.reload` and `window.location` are unforgeable in real Chromium**: assigning or `Object.defineProperty`-ing `reload`/`location` throws `TypeError: Cannot assign to read only property 'reload' of object '[object Location]'`.
- **Any `Location` navigation** — `reload()`, `assign(url)`, `replace(...)`, `location.href = ...`, or a helper that calls one — triggered while an `await` is pending navigates the browser-test page away; the runner reports no progress (`0/N files completed`) and hangs until timeout.
- Window-mode navigation is **not assertable in a real browser**: skip it, add an injectable reload seam, assert a pre-reload side-effect, or extract a pure predicate and assert it (plus that `fetch` was never called).
- **`frame.reload()` is NOT a problem** — only window-mode `window.location.reload()` moves the top page; keep frame-mode tests intact.
- If a previously dormant suite starts hanging after you widen the test glob to `.tsx`, run the hanging file alone under an OS-level `timeout` to isolate it.
- **Crash cards swallow the stack**: the app's `try/catch` consumes the exception before Playwright sees it, so `pageerror`/console listeners yield only the message. Wrap the throwing DOM method in `page.addInitScript` (runs before app code, re-arms on every document) and stash the stack on `window`.
- Wrap **one method** when the message names it (`Node.insertBefore` → `Node.prototype.insertBefore`); otherwise wrap the usual suspects (`insertBefore`, `appendChild`, `removeChild`) together. Capture `this.nodeName`/`node.nodeName` too, to answer **what** was inserted **where**.
- The captured stack reveals the **full async chain** (real case: SSE `invalidate` listener → `window.location.reload()` → Navigation-API interception → frame reload → stream diff). If the failure *does* navigate, stash the stack on `sessionStorage` instead of `window` — it survives same-origin navigations while `addInitScript` re-arms each document.
- **DOMException messages are browser-specific**: `Node.insertBefore: Cannot insert a Text as a child of a Document` is Firefox style; `Failed to execute 'insertBefore' on 'Node': ...` is Chromium style. Reproduce in the engine whose wording matches the report — Chromium silently tolerated what Firefox threw in the source case.

## When to Use

- A Playwright/e2e navigation or submit times out on a page that mounts an SSE/EventSource channel, or `networkidle` never settles.
- A browser test (`*.test.browser.tsx`) hangs ("Timed out waiting ... for browser test progress") after dispatching an event that triggers `window.location.reload()`; stubbing `window.location` throws "Cannot assign to read only property 'reload'".
- A browser test reports no progress at all (`0/N files completed`) after the code under test calls `window.location.assign(...)`, `location.replace(...)`, or `location.href = ...`.
- A browser app shows a generic "Unexpected Error / Something went wrong" card and `pageerror`/console capture yields only the message, never a stack.
- A crash report mentions a DOM API by name (`insertBefore`, `appendChild`, …) — wrap that prototype method and rerun.
- Deciding which browser to reproduce in: match the DOMException message style (Firefox vs Chromium wording) to the report.

## Related Skills

- `remix3-testing` (`references/cliententry-browser-test-stubs.md`) — controlled fixture + `Object.defineProperty` stubs for browser-test DOM effects that `render`/`act` cannot drive
- `remix3-bun-runtime` — running the `remix run`/`remix test` suite under Bun
- `remix3-frame-cliententry` — `<Frame>` navigation, `clientEntry` hydration, and frame-render tests
- `remix3-testing` (`references/html-amp-escaped-assertions.md`) — matching HTML-escaped `&` in `remix test` string assertions
