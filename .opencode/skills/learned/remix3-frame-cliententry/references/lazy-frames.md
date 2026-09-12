# Deferring Frames Until They Are Visible (Lazy Frames)

## What This Covers

Read this when a Remix 3 page resolves frames for content the user cannot see yet — rows inside collapsed `<details>`, sections below the fold, a pane hidden until a selection exists — or when asked to make frames load lazily. Upstream demo: `~/remix/demos/lazy-frames`; app port: `app/ui/lazy-frame.browser.tsx`.

## Which Frames May Be Deferred

`LazyFrame` server-renders a placeholder and mounts a real `<Frame>` only once an `IntersectionObserver` reports the host near the viewport. A mounted frame stays mounted, so scrolling back or reopening a disclosure never refetches.

Safe to defer — content nothing points at:

- frames inside a collapsed `<details>` or another unrendered container
- below-the-fold sections on a long page

Must stay eager — a frame that has not mounted cannot be addressed:

- navigation targets: `data-rmx-target`, `<form>` targets, sidebar `NavLink`s
- frames addressed by name from an entry or an SSE stream (`handle.frames.get(name)`)
- the shell self-relay frames (`src` = the request URL) and panel frames an SSE reconnect reloads
- anything whose failure must surface as a rendered `fallback`

Verified example: `/admin`'s recent-activity fragment rendered one nested user-detail frame per activity row inside a collapsed `<details>`. Every dashboard render resolved six of them — six `requireAuth`/`requireAdmin` passes, six `db.find(users, …)` session lookups, six renders — and inlined content the user had not asked to see. Deferred, a collapsed dashboard makes zero user-detail requests.

The counter-example in the same app is the chatlog detail pane (`app/ui/admin-chatlog-page.tsx`): it is hidden until a row is selected, but `app/ui/admin-chatlog-detail.browser.tsx` drives it with `handle.frames.get(DETAIL_FRAME)`. Deferring it makes that lookup return `undefined`; the click then falls through to a full frame navigation instead of the in-place pane reload. Leave it eager.

## Implementation Notes

App port deltas from the upstream demo:

- forward `name` — load-bearing, see below
- the host needs a non-zero box or `IntersectionObserver` may never report it once a hidden container opens. A `css()` mixin on the element the entry itself returns is safe (composed during SSR, re-created with a live `type` on the client).

## Trap: `name` Is Load-Bearing For Auth Failure

`name` makes the frame request carry `X-Remix-Target`, which decides how an expired session fails:

- **with `name`**: `requireAuth` takes its sub-frame branch (`X-Remix-Frame: true` plus non-null `X-Remix-Target`) and returns a 401 fragment; `resolveFrameResponse` sees 401 and does a full-page login redirect.
- **without `name`**: the route 302s, `fetch` follows it, and `response.redirected && options?.target` is false — so the login **document** is returned as frame content and injected into the page.

Nothing else addresses these names, so `name` reads as removable. Comment it.

## Trap: No `css()` Mixins In `children`/`fallback`

Props cross the client-entry boundary by serialization, which drops a mixin descriptor's function `type` and makes hydration throw `Invalid mix prop` — the whole document becomes the error card. Pass plain text/markup and style it from the server-rendered shell. Full mechanism and evidence: authoring constraint 5 in `references/cliententry-lifecycle.md`.

## Measuring Frame Fan-Out Server-Side

Prove the eager cost without a browser: fetch the fragment through the shared test router (`app/test-router.ts`) with an admin cookie and count what the server resolved — frame markers, the nested route's srcs, and inlined payload text. The server log shows the parent fragment request immediately followed by the nested ones. Expect several `user-detail/*` requests for one recent-activity request before the change, and none after.

That same fetch is the regression test: assert the fragment ships placeholders and none of the resolved payload. Assert on the payload the controller owns, not on frame-marker internals, or the guard passes vacuously when the runtime renames them.

## Verifying Browser Behavior

`app/actions/admin/fragments/lazy-frames.test.e2e.ts` counts requests to the frame route per page and asserts: 0 while collapsed (and no loaded content in the DOM), exactly 1 after opening, still 1 after closing and reopening — retention, because the mounted frame is not remounted.

## Cost

A client-entry-bearing fragment ships the inline import map (~22 KB in this app; `/admin/chatlog` and `/admin/uploads` already carry one) plus serialized per-row entry props. Weigh that against the removed resolutions; on a small fragment it is not a free win.

Use when adding or reviewing deferred/lazy frames, when a page resolves frames behind hidden or offscreen content, when `handle.frames.get(name)` returns `undefined` for a frame that was made lazy, or when a frame request starts arriving with `X-Remix-Target`.
