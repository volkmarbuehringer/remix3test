# Browser tests: `window.location.reload()` is unforgeable

**Source:** `chromium-window-location-reload-unforgeable`

**Context:** A Playwright/Chromium browser test (`*.test.browser.tsx`) hangs the whole suite with `Timed out waiting 90000ms for browser test progress (X/Y files completed)` after dispatching an event that triggers `window.location.reload()`.

`window.location.reload` (and `window.location` itself) is **unforgeable** in a real Chromium page: you cannot stub or override it, even in strict mode.

```js
// THROWS in real Chromium:
window.location.reload = () => {}            // TypeError: Cannot assign to read only property 'reload' of object '[object Location]'
Object.defineProperty(window.location, 'reload', { value: () => {} })  // same
Object.defineProperty(window, 'location', { value: fake })            // same
```

So a test that renders a component calling `window.location.reload()` (e.g. on an SSE `invalidate`/`navigate` event), then emits that event, **actually reloads the page**. The reload navigates the test context away while an `await` is pending, so the test never resolves and the runner hangs until timeout. It even works in jsdom-like harnesses where `window.EventSource` or other props are assignable — only the `Location` object is hardened.

The same applies to **every** `Location` navigation — `window.location.assign(url)`, `location.replace(...)`, `location.href = ...` — and to any helper that calls one on the caller's behalf (e.g. a frame resolver that bails to document navigation when it rejects a source). Triggering one while an `await` is pending navigates the test page away, so the runner reports no progress for the whole file.

Treat the window-mode navigation as **not assertable in a real browser** and choose one of:

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
4. **Extract a pure predicate.** When the branch's only observable is the navigation, export the decision as a pure function and assert that — plus that `fetch` was never called. This is the tested shape of the app's same-origin frame-resolver guard (`isSameOriginFrameSource(url)`, 2026-09-12): the cross-origin branch calls `window.location.assign`, so the test asserts the predicate instead of driving the resolver.

Note: **frame reload** (`frame.reload()`) is NOT a problem — only window-mode `window.location.reload()` navigates the top page. Keep frame-mode tests intact.

If a suite that previously "passed" as dormant `.tsx` browser tests starts hanging once you widen the test glob to include `.tsx`, run the file alone under an OS-level `timeout` to isolate the hanging test.
