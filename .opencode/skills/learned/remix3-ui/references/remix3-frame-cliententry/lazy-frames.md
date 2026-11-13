# Deferring Frames Until They Are Visible (Lazy Frames)

## What This Covers

Read this when a Remix 3 page resolves frames for content the user cannot see yet — rows inside collapsed `<details>`, sections below the fold, a pane hidden until a selection exists — or when asked to make frames load lazily. The app uses the runtime's built-in `Frame loading="lazy"` (since #12229); its old app-owned `LazyFrame` client entry was removed after the 5af14d52 bump.

## Which Frames May Be Deferred

Built-in lazy frames server-render only their fallback and frame metadata; `run()` resolves them when the fallback nears the viewport. The loaded content stays mounted, so scrolling back or reopening a disclosure never refetches.

Safe to defer — content nothing points at:

- frames inside a collapsed `<details>` or another unrendered container
- below-the-fold sections on a long page

Must stay eager — a frame that is not loaded yet cannot serve initial content:

- navigation targets: `data-rmx-target`, `<form>` targets, sidebar `NavLink`s
- frames addressed by name immediately from an entry or an SSE stream (`handle.frames.get(name)`) whose initial content must already be present
- the shell self-relay frames (`src` = the request URL) and panel frames an SSE reconnect reloads
- anything whose initial failure must surface as a rendered `fallback`

Verified example: `/admin`'s recent-activity fragment renders one nested user-detail frame per activity row inside a collapsed `<details>`, using `<Frame loading="lazy" name=… src=… fallback={…} />`. Every dashboard render used to resolve six of them — six `requireAuth`/`requireAdmin` passes, six `db.find(users, …)` session lookups, six renders — and inlined content the user had not asked to see. Now a collapsed dashboard makes zero user-detail requests and the fragment needs no client entry at all.

The counter-example in the same app is the chatlog detail pane (`app/ui/admin-chatlog-page.tsx`): it is hidden until a row is selected, but `app/ui/admin-chatlog-detail.browser.tsx` drives it with `handle.frames.get(DETAIL_FRAME)`. Leave it eager; verify named-frame registration before making an addressed pane lazy.

## Built-in `loading="lazy"` behavior (pin `5af14d52`)

- Eager is the default. `loading="lazy"` requires a fallback that renders at least one DOM element; a text-only or empty fallback logs a warning and loads immediately (the runtime does not insert a placeholder).
- Without `run()` or `IntersectionObserver`, lazy frames load immediately. Deferred frames do not delay `app.ready()` or ancestor navigation completion.
- The loading boundary extends one viewport in each direction and updates on resize; there is no custom `rootMargin`.
- Initial lazy viewport loads and viewport retries do **not** dispatch `reloadStart`/`reloadComplete`. Only explicit `frame.reload()`/`replace()`, targeted navigations, and ancestor reloads do.
- Ancestor reloads refresh loaded lazy frames in the background while keeping their content visible; changing `loading` to `'eager'` starts a deferred load immediately.
- An unresolved lazy load cancelled by navigation resumes viewport observation; the fallback stays mounted until replacement content starts rendering.

The removed app-owned `LazyFrame` also supported a custom `rootMargin` and `pauseAnimationsWhenInactive` (observer pooling plus a host-level CSS animation pause). Neither had a production call site after the recent-activity migration; do not reintroduce them without a concrete need. A paused-animation or custom-boundary use case would need a new app observer around the built-in frame, not a second frame implementation.

## Trap: `name` Is Load-Bearing For Auth Failure

`name` makes the frame request carry `X-Remix-Target`, which decides how an expired session fails:

- **with `name`**: `requireAuth` takes its sub-frame branch (`X-Remix-Frame: true` plus non-null `X-Remix-Target`) and returns a 401 fragment; `resolveFrameResponse` sees 401 and does a full-page login redirect.
- **without `name`**: the route 302s, `fetch` follows it, and `response.redirected && options?.target` is false — so the login **document** is returned as frame content and injected into the page.

Nothing else addresses these names, so `name` reads as removable. Comment it.

## No Client-Entry Boundary

The built-in lazy fallback is server-rendered and never crosses a client-entry props boundary, so a `css()` mixin on it is safe and hydrates normally. The former `LazyFrame` `children`/`fallback` serialization constraint no longer applies to this path; the general clientEntry serialization rules still live in `references/remix3-frame-cliententry/cliententry-lifecycle.md` constraint 5.

## Measuring Frame Fan-Out Server-Side

Prove the eager cost without a browser: fetch the fragment through the shared test router (`app/test-router.ts`) with an admin cookie and count what the server resolved — frame markers, the nested route's srcs, and inlined payload text. The server log shows the parent fragment request immediately followed by the nested ones. Expect several `user-detail/*` requests for one recent-activity request before the change, and none after.

That same fetch is the regression test: assert the fragment ships placeholders and none of the resolved payload. Assert on the payload the controller owns, not on frame-marker internals, or the guard passes vacuously when the runtime renames them.

## Verifying Browser Behavior

`app/actions/admin/fragments/lazy-frames.test.e2e.ts` counts requests to the frame route per page and asserts: 0 while collapsed (and no loaded content in the DOM), exactly 1 after opening, still 1 after closing and reopening — retention, because the loaded frame is not remounted.

The built-in lazy-loading behavior itself is covered by the vendor `@remix-run/component` frame tests; the app no longer carries a browser test for its own deferral mechanism.

## Cost

A server-only fragment avoids the former client entry/import map and per-row serialized props (the recent-activity fragment previously carried `LazyFrame` solely for deferral). The server sends only the fallback plus frame metadata; nested user-detail work starts when the disclosure opens. Keep the fallback element large enough to represent the pending content and avoid layout shifts.
