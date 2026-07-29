## Context

The app uses a Remix3 frame-based architecture. Frame content is fetched client-side via `resolveFrameResponse()` in `app/assets/entry.tsx`, which does a plain `fetch(url, { headers, signal })` without cache control. This lets the browser cache frame HTML and serve stale content on back/forward navigation.

Meanwhile, `frame.reload()` is called from 17 sites across 10 files. Error handling is inconsistent: 2 sites have no `.catch()` at all (unhandled promise rejections), 2 silently swallow errors during agent-driven navigation, and the rest use `.catch(() => {})` for background refreshes.

Recent upstream Remix changes also made `resolveClientFrame()` dispatch `ComponentErrorEvent` to `runtime.errorTarget` (the `app` object in `entry.tsx`) on ancestor-initiated reloads, instead of silently swallowing. The app's global error handler at `entry.tsx:75` disposes the entire app on any error event — making it important to understand when this path can fire.

## Goals / Non-Goals

**Goals:**
- Prevent browser from serving stale frame HTML by adding `cache: 'no-store'` to all client frame fetches
- Eliminate unhandled promise rejections from `frame.reload()` calls
- Surface navigation failures to the user consistently (not silent)
- Keep background-refresh errors suppressed (they're noise)

**Non-Goals:**
- Rewriting the error handling architecture (e.g., introducing error boundaries)
- Changing the server-side frame resolution or `fragmentResponseInit()`
- Adding nested client frame support (the cascade reload fix is transparent to this app)

## Decisions

### Decision 1: `cache: 'no-store'` on the fetch, not `no-cache`

`no-store` prevents the browser from storing the response in any cache at all. `no-cache` would still store it but require revalidation. Frame content is session-specific and must never be cached — `no-store` is the correct choice.

### Decision 2: `.catch()` on background refreshes, `.then(success, showError)` on navigation

Two patterns, clearly distinguished:

- **Navigation** (agent-driven `frame.src = href; frame.reload()`):
  ```ts
  frame.reload().then(
    () => restoreFilterValue(href),
    (err) => showError('Navigation failed: ' + String(err)),
  )
  ```
- **Background refresh** (SSE complete, form submit, connection retry):
  ```ts
  frame.reload().catch(() => {})  // user didn't request this, silent
  ```

### Decision 3: `.catch()` not optional for `frame.reload()`

The 2 sites that lack `.catch()` (connection-indicator and grid-refresh-button) will get it. The `grid-refresh-button` case is user-initiated (click), so it should surface errors:

```ts
// grid-refresh-button — user clicked refresh, show errors
handle.frame.reload().catch(() => {
  handle.update()  // reset pending state at minimum
})
```

The `connection-indicator` reload is background triggered by an SSE `invalidate` event — `.catch(() => {})` is appropriate.

## Risks / Trade-offs

- **[Low] Frames that previously got stale content will now always hit the server** — adds a round-trip on b/f nav, but frame HTML is lightweight and this is the correct behavior.
- **[Low] Navigation errors that were silent will now surface** — some users may see error messages they never saw before. This is desired — it reveals real failures.
- **[Low] The global error handler in `entry.tsx:75` could fire if a nested client frame resolution fails during ancestor reload** — this app has no nested client frames, so the path is theoretical. Worth noting for future reference.
