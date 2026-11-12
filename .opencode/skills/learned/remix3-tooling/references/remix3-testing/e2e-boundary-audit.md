# E2E boundary audit: keep one e2e per real integration path

**Extracted:** 2026-11-12
**Context:** A project has both browser tests (`*.test.browser.tsx`) and e2e tests
(`*.test.e2e.ts`). E2E is slower and flakier because it re-tests client behavior
through the full server/router/browser stack.

## Problem

An e2e suite grows by default: every new UI behavior gets an e2e case because the
existing e2e file already has setup. The suite then pays browser startup, SSR,
DB round-trips, and frame navigation for assertions that only need a DOM node,
a stubbed fetch, or a keyboard event. Flakes increase because each e2e case adds
more parallel server/DB/SSE load.

Browser tests are not automatically better. They are cheaper and more direct,
but they bypass real hydration, real frame navigation, and the real server. The
goal is not "move everything"; it is to place each failure mode at the cheapest
layer that can still catch it.

## Boundary inventory

Classify every e2e test before changing it:

| The test needs... | Keep it in e2e? |
| --- | --- |
| a real HTTP/router/SSR response | yes |
| a real frame swap, named-frame registration, or history/navigation behavior | yes |
| a real DB row, `If-Match`, merge/copy/move persistence | yes |
| a real upload/download/zip/pdf response | yes |
| CSP enforcement or report delivery | yes |
| a live SSE/streaming connection | yes |
| only client state, rendering, keyboard/focus, stubbed fetch | no — browser test |
| only CSS geometry/layout that a real browser can measure | browser test, unless the geometry depends on the real frame/shell |
| hover/pointer modality that `.click()`/`.focus()` cannot reproduce | e2e or a real-pointer browser test; see `input-modality-and-hover-testing.md` |
| a native `<select>` change in Firefox that Playwright synthetic events miss | keep an e2e smoke, scope mutation assertions to Chromium |

## Migration procedure

1. **Baseline first.** Record full browser and e2e counts/runtime before changing
   anything. Do not compare a targeted run to a full run.
2. **Write the browser test first.** Render the client entry directly (or use
   `createRoot`/`run()` with a stubbed `resolveFrame`), stub `fetch`, and assert
   the same failure mode the e2e test protects.
3. **Prove it catches the regression.** If the browser test would pass with the
   production bug reintroduced, it is not equivalent; keep the e2e assertion.
4. **Slim or remove the e2e case.** Keep one small integration smoke per real
   endpoint/path (for example one autosave round trip, one merge, one download).
   Delete duplicated client assertions rather than adding another e2e variant.
5. **Measure again.** Report browser/e2e counts and runtime before → after, and
   list which case each retained e2e still protects.
6. **Repeat one file/describe block at a time.** Small commits are easier to
   review and revert than a suite-wide move.

## Rules

- **Never weaken coverage to reduce a count.** The browser test must fail for
  the same regression, not merely assert a similar-looking DOM state.
- **One e2e per integration path.** Real server writes, frame navigation, file
  transfer, CSP, and SSE deserve an e2e; combinations of client states do not.
- **Use signals, not sleeps.** Wait for hydration markers, mutation responses,
  URL/content changes, or event promises. The deterministic-wait patterns are in
  `test-harness-gotchas.md`.
- **Keep pointer-modality cases honest.** `.click()` never sets `:hover`; a
  browser test can pass where a real mouse fails. Keep the real pointer path in
  e2e when hover/focus reveal is the behavior under test.
- **Firefox native selects are special.** `page.selectOption()` may not reach a
  remix change handler in Firefox; keep a Firefox smoke and scope mutation
  assertions to Chromium when needed.
- **WebKit is opt-in engine coverage.** In this app, `npm run test:webkit`
  (`PLAYWRIGHT_WEBKIT=1`) runs browser + e2e under Playwright WebKit. It is
  engine coverage, not the Safari app; the support floor stays Safari/iOS 18.2+.
  Do not fake Safari coverage with a Chromium "safari-sized" viewport.

## App evidence (2026-11-12)

- Current shape after the wait cleanup: ~1,030 browser tests vs 224 e2e tests.
- Retained e2e examples: lists autosave round trip, copy/merge/move persistence,
  PDF/zip downloads, CSP route matrix + report delivery, frame history
  replacement, real view-transition/scroll restoration.
- Browser-test candidates: sidebar menu dismissal/focus, page-size keyboard
  stepping/sync, list row menu actions, client-only autosave payloads, lazy-frame
  deferral, frame fallback/retry, error-card animation.
- The new coverage added during that cleanup was browser/unit only; no new e2e
  tests were added.

## When to Use

- The e2e suite is slow or flaky and many cases only assert client behavior.
- A new UI behavior is about to be added as another e2e case by default.
- You need to decide whether a failing test belongs in browser or e2e before
  fixing it.
- You are auditing an existing suite for duplicated coverage.
