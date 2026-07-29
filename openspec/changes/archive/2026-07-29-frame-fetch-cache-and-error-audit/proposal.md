## Why

Upstream Remix changes (recent commits to `preview/main`) introduced an ancestor-frame reload cascade and type-level mixin variance fixes. The app must adapt to stay compatible, eliminate stale-content risks from browser-cached frame fetches, and fix inconsistent error handling across 17 `frame.reload()` call sites where silent `.catch(() => {})` swallowing and unhandled promise rejections hide real failures.

## What Changes

- **Add `cache: 'no-store'`** to the client-side frame fetch in `app/assets/entry.tsx` to prevent the browser from serving stale HTML on back/forward navigation.
- **Fix 2 silent navigation failures** in `agent-events-stream.browser.tsx` and `workflow-agent-stream.browser.tsx` where `.then(onSuccess, () => {})` silently discards reload errors after agent-driven navigation.
- **Fix 2 unhandled promise rejections** in `connection-indicator.browser.tsx` and `grid-refresh-button.browser.tsx` where `frame.reload()` is called without `.catch()`.
- **No code changes needed** for the client-frame cascade reload (the app's architecture has no nested client frames) or the mixin variance fix (14 existing `<select mix={css(...)}>` usages now compile correctly without workarounds).

## Capabilities

### New Capabilities
- `frame-fetch-caching`: Client-side frame fetch with `cache: 'no-store'` to guarantee fresh HTML per frame load.
- `reload-error-handling`: Consistent error handling across all `frame.reload()` call sites — navigation failures surface to the user, background refreshes suppress gracefully.

### Modified Capabilities

None.

## Impact

- **`app/assets/entry.tsx`** — one-line addition (`cache: 'no-store'` to the fetch call).
- **`app/assets/streams/agent-events-stream.browser.tsx`** — fix silent error swallowing in navigation `.then()`.
- **`app/assets/streams/workflow-agent-stream.browser.tsx`** — fix silent error swallowing in navigation `.then()`.
- **`app/ui/connection-indicator.browser.tsx`** — add `.catch()` to prevent unhandled promise rejection.
- **`app/ui/grid-refresh-button.browser.tsx`** — add `.catch()` or try/catch to prevent unhandled promise rejection.
