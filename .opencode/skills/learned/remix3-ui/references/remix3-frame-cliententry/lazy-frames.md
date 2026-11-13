# Deferring Frames Until They Are Visible (Lazy Frames)

## What This Covers

Read this when a Remix 3 page resolves frames for content the user cannot see yet — rows inside collapsed `<details>`, sections below the fold, a pane hidden until a selection exists — or when asked to make frames load lazily. The app uses the runtime's built-in `Frame loading="lazy"` (since #12229); its old app-owned `LazyFrame` client entry was removed after the 5af14d52 bump.

## Which Frames Are Deferred (verified, pin `5af14d52`)

Built-in lazy frames server-render only their fallback and frame metadata; `run()` resolves them when the fallback nears the viewport. The loaded content stays mounted, so scrolling back or reopening a disclosure never refetches.

General rule before adding one: a frame may be deferred only when nothing needs its content before it is on screen. Keep it eager if it is a navigation/form target, if an entry or SSE stream addresses it and expects initial content, if its first paint is the no-JS UI, or if it is a blocking frame with no fallback.

Verified adoption points:

- **`/admin` section cards** (`app/ui/admin-page.tsx`): `admin-stats` and `admin-recent-activity` sit below the admin page scroller's fold at 1280×720. A fresh render ships reserved-height (15.5rem) `FrameFallback` slots; scrolling `System & Aktivität` into view requests each fragment exactly once, and further scrolling requests nothing more. `app/actions/admin/fragments/lazy-frames.test.e2e.ts` counts both routes — 0 before the scroll, 1 each afterwards. Trade-off: these two cards are JS-only; without JS they show the fallback's noscript copy.
- **`/admin` recent-activity user details** (`app/ui/admin-fragments/recent-activity-fragment.tsx`): one nested frame per activity inside a collapsed `<details>`; zero user-detail requests while collapsed, one on open, retained on reopen. This was the original 72a7ad0f adoption. Every dashboard render used to resolve six of them — six `requireAuth`/`requireAdmin` passes, six `db.find(users, …)` session lookups, six renders — and inlined content hidden behind a collapsed disclosure.
- **`/admin/chatlog` detail pane** (`app/ui/admin-chatlog-page.tsx`): hidden (`display: none`) until a row is selected, so the empty `none` transcript is no longer resolved into every page render (nor fetched by the browser). Selecting a row still loads the transcript in place through `handle.frames.get(DETAIL_FRAME)`, the post-reload remembered selection is restored the same way, and a server-rendered `?detail=` document carries `data-chatlog-selected-id` so the entry keeps that pane open instead of collapsing it for empty sessionStorage. `app/actions/admin/chatlog/chatlog-detail-frame.test.e2e.ts` asserts one request per selection, a stable `/admin/chatlog` URL, a list that stays mounted, and the direct `?detail=` load; `app/actions/admin/admin-chatlog.test.ts` pins the server side (fallback shipped, no inlined transcript, no nested `<template>`).

Must stay eager:

- `agentEventsPanel` / `supportAgentPanel` — SSE streams and targeted navigation.
- settings panel, appointment content/appointments-new, and the `FrameShell` self-relay frames — blocking frames (no fallback) whose first paint and no-JS UI are the resolved content; the settings POST validation state also lives in that render.
- `appointTypes` sidebar frame (`app/ui/appointment-page.tsx`) — measured visible at 1280×720 and 1440×900 (content at y≈432; page scroller 61–699/879) and nothing addresses it by name. Re-measure before changing the target viewports.
- any blocking frame with no fallback, and any frame whose first-load UI depends on `reloadStart`/`reloadComplete` (initial lazy loads and viewport retries do not emit them).

## Proving a Named Frame Before Deferring It

`createFrame` registers `name` with the runtime's named-frame registry before `hydrateInitial()` can defer the load (`frame.ts:477-480` in the installed `@remix-run/component`), so `handle.frames.get(name)` resolves while the frame is still pending. Two guards keep that honest:

- `app/ui/frame-fallback.test.browser.tsx` covers both fallback states. A hidden lazy frame makes zero requests and offers no retry (a deferred slot is not a stalled one); a visible lazy frame starts loading, shows the retry once it stays pending, and the click reloads the *named* frame (`/deferred`, not the containing `/`) before the response replaces the fallback.
- The chatlog e2e reloads the document with a remembered selection. `restoreSelection()` runs from the entry's `queueTask` before the lazy frame has loaded and still resolves the handle to reopen the transcript — the app-level check of the same ordering.

`FrameFallback`'s retry wait starts when the slot first intersects the viewport, not when it mounts. That is deliberately a one-shot visibility gate for the retry copy only; it is not a second lazy loader, and it must be removed if the frame runtime ever exposes "load started" to the fallback.

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

`app/actions/admin/fragments/lazy-frames.test.e2e.ts` covers both layers. It counts the `/admin/fragments/stats` and `/admin/fragments/recent-activity` requests: 0 while the dashboard is at the top of its scroller, 1 each after `System & Aktivität` is scrolled into view, and still 1 after scrolling to the bottom and back. It also counts user-detail requests per disclosure: 0 while collapsed (and no loaded content in the DOM), exactly 1 after opening, still 1 after closing and reopening — retention, because the loaded frame is not remounted.

The dashboard test waits for the notification bell's `/notifications/unread-count` response as a real shell-hydration signal (a fixed delay would let slow hydration make the zero-request assertion vacuous), then asserts the stats fallback's box starts below the scroller's clip. That geometry check is the premise: if a copy or font change brings the card into view, lazy loading is supposed to start and the test must be re-based.

Scroll the app's page scroller, not the window: `[data-page-scroller]` (`app/ui/layout.tsx`) is the overflow container, and it clips the observed fallback. A frame just below that scroller's fold therefore stays deferred even though its rect is within one viewport of the window; `element.scrollIntoView({ block: 'start' })` on the section heading moves the right container. Pin the viewport in the test (1280×720) so the section stays below the fold and the zero-request assertion is not project-default dependent.

`app/actions/admin/chatlog/chatlog-detail-frame.test.e2e.ts` drives a seeded chatlog through the test fixtures: it asserts no transcript request while the pane is closed, exactly one after a row click, a list that stays mounted, an unchanged `/admin/chatlog` URL, a remembered selection that reopens after a document reload, and a direct `?detail=` document that keeps its server-opened pane and loads exactly one transcript.

The built-in lazy-loading behavior itself is covered by the vendor `@remix-run/component` frame tests; the app no longer carries a browser test for its own deferral mechanism.

## Cost

A server-only fragment avoids the former client entry/import map and per-row serialized props (the recent-activity fragment previously carried `LazyFrame` solely for deferral). The server sends only the fallback plus frame metadata; nested user-detail work starts when the disclosure opens. The built-in fallback is server-rendered too: `/admin` ships two reserved-height slots instead of two resolved cards, and `/admin/chatlog` ships a hidden pane whose fallback is never observed until the pane opens. Keep the fallback element large enough to represent the pending content and avoid layout shifts.
