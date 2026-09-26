# Frame Failures, Complete-HTML Rendering, and Interception Limits

**Source:** Installed guide `node_modules/remix/guides/06-streaming-ui-with-frames.md` — "Stream a fallback first" (L97–114), "Render the response as a stream" (L116–158), "Resolve frames in the browser" (L160–218), "Name and reload frames" (L220–244), "Navigate a frame with a form" (L246–272), "Target a frame from a link" (L321–344), "Handle failures and cancellation" (L346–358). Vendor source under `node_modules/.pnpm/@remix-run+*/node_modules/@remix-run/`: `render-middleware` `dist/lib/render-ui.js` (`render()` L44–61, `resolveFrame` L67–84, `followFrameRedirects` L106–128) and `dist/lib/render.js` (`renderWith` L13–17); `ui` `dist/server/stream.js` (`renderToStream` L77–163, `defaultResolveFrame` L181–183, `renderToString` L1318–1324).

**Extracted:** 2026-09-26

**Context:** Deciding what a non-success frame response should become, where frame render errors surface, whether returned frame HTML is safe, when to use `renderToString`/`renderWith`, why a `data-rmx-src` link or frame form is not intercepted, or why a clientEntry's server props are stale after a frame reload.

## Problem

The guide's failure contract has two reporting hooks and one decision point, but this app has replaced the sample resolver: HTTP failures become in-frame HTML rather than throws, so the browser `error` event only sees genuine runtime faults. Two other guide facts are easy to invert: a supplied `data-rmx-src` is always subject to the same-origin check regardless of target, and native constraint validation plus the native `submit` event run before Remix intercepts — which matters here because several admin forms set `novalidate`. Finally, a clientEntry keeps its setup state across a frame reload while `handle.props` refresh, so server-derived values cached in the factory closure silently freeze.

## Solution

**Failure and cancellation contract (guide L140–142, L346–358)**

- Server hook: `render()`'s `onError`. This app calls `render({ assets: assetServer })` with no callback (`app/middleware/root.ts:79`). Upstream defaults a missing callback to `console.error` (`ui` `dist/server/stream.js:79`) but forces it to a no-op for any request carrying `X-Remix-Frame: true` (`render-middleware` `dist/lib/render-ui.js:48`). Net effect here: top-level document render failures reach `console.error`; fragment render failures are silent by design, and the frame `fallback` is the only visibility mechanism.
- Browser hook: the `error` event on the app returned by `run()`. `app/assets/entry.tsx:44–56` disposes the app, fades the body, and renders the fatal card (`app/assets/error-card.browser.tsx`). This fires for genuine runtime faults, not for HTTP failures.
- The resolver decides the non-success outcome (`app/assets/frame-response.browser.tsx`): a cross-origin src is never fetched and becomes a document navigation (`:25–30`); a 401 becomes the full-page login redirect (`:68–71`), whose matching 401 fragment is produced by `requireAuth` for sub-frame requests (`app/middleware/auth.ts:94–109`); a 4xx body is returned as frame content so a validation re-render or not-found page shows in the slot (`:73–81`); a 5xx becomes a bounded `ErrorCard` fragment (`:83–94`). Only network/stream faults reject to the runtime `error` event — unlike the guide's sample resolver (L188–190), which throws on any `!response.ok`; do not copy that sample verbatim into this app.
- A deferred frame that fails after its fallback chunk was sent cannot be replaced by an error response (guide L352–354). Upstream catches the pending-frame rejection, reports it through `onError`, and leaves the already-streamed fallback in place (`ui` `dist/server/stream.js:1267–1270`). Keep fallbacks meaningful.
- `request.signal` propagates from the outer request into frame work: the renderer passes it to `renderToStream` and the internal frame fetch (`stream.js:110–116`; `render-ui.js:53`, `:115`), this app's in-frame redirect follow forwards the outer signal to its re-fetch (`app/middleware/frame-redirect.ts:70`), and the browser resolver forwards `options.signal` to `fetch` (`app/assets/frame-response.browser.tsx:54`). The server entrypoint suppresses logging for an error that is exactly the abort reason (`app/utils/server-handler.ts:26`).

**Security: returned frame HTML is not sanitized (guide L209–213)**

Remix reconciles returned frame HTML into the current document without sanitizing it, and same-origin user-generated HTML is not implicitly safe. This app re-implements the same-origin restriction rather than trusting the runtime: `isSameOriginFrameSource` (`app/assets/frame-response.browser.tsx:8–19`) compares against `window.location.origin` and falls back to a document navigation otherwise, and the redirect-follow middleware refuses a cross-origin `Location` (`app/middleware/frame-redirect.ts:54–55`). Frame HTML can select client-entry modules and contribute import maps, styles, and nested frames, so a route that echoes unescaped user input must be escaped/sanitized before it is pointed at; the CSP installed by `app/middleware/security-headers.ts` does not sanitize frame HTML.

**`renderToString()` for a complete HTML value (guide L147–158)**

`renderToString()` is exported from `remix/ui/server`; it drains `renderToStream` to a string and rethrows through `onError` instead of reporting (`ui` `dist/server/stream.js:1318–1324`). It accepts no frame options, so any `<Frame>` in the tree reaches `defaultResolveFrame` and throws `No resolveFrame provided` (`stream.js:181–183`). Use it only for frame-free complete HTML — an email preview or an embedded fragment — never for normal page/fragment responses, which stream through `context.render` here. There is no `renderToString` call in `app/` today; frame fragments use `context.render(..., fragmentResponseInit())` (`app/utils/fragment-response.ts`).

**`renderWith()` for a different renderer or response type (guide L144–145)**

`remix/middleware/render` exports `renderWith` alongside `render`; `renderWith(createRenderer)` installs a per-request `context.render` (`render-middleware` `dist/lib/render.js:13–17`). This app uses the standard `render()` (`app/middleware/root.ts:79`) and emits non-HTML through its own `json()` middleware (`app/middleware/json-render.ts`, wired at `root.ts:80`), so it has no `renderWith` call site. Reach for `renderWith` only when a route family needs a genuinely different renderer, not to emit JSON.

**`data-rmx-src` must be a valid same-origin URL regardless of target (guide L321–344, L335–341)**

`data-rmx-target` chooses a mounted named frame; `data-rmx-src` only chooses the request used to fill it. A supplied src must be a valid same-origin URL whatever the target — an invalid or cross-origin value disables interception and the browser performs the ordinary document navigation to `href`. With no target, `href` is used as the top frame's source so the frame stays in sync with the address bar. The app's only producer is `app/ui/nav-link.tsx:32–34`, which emits both attributes from relative route hrefs and does no origin check — the runtime is the sole guard. (For POST forms `data-rmx-src` does not substitute for `frame.src`; see the vendor constraints in `references/frame-navigation.md`.)

**Native validation and `submit` run before interception (guide L262–263)**

A frame-targeted form is a normal document form until the runtime intercepts it: native constraint validation and the form's native `submit` event run first, so any `submit` listener the app registers fires before Remix's interception. That includes delegated listeners (`app/ui/settings-enhance.browser.tsx:256`, capture-phase in `app/ui/message-compose.browser.tsx:101`) and per-form ones under `app/assets/streams/public/`. This is event/validation ordering, not click or pointer pre-emption. Several admin CRUD forms disable constraint validation with `novalidate` (`app/ui/admin-users-page.tsx:635`, `app/ui/admin-lists-page.tsx:795` and `:909`, `app/ui/admin-appointments-form.tsx:140`, `app/ui/admin-offerings-create-page.tsx:80`, `app/ui/admin-offerings-edit-page.tsx:109`, `app/ui/appointments-new-step2.tsx:274`), so their `required` markers never gate a submission — the controller's own validation is first.

**Client entries keep setup state and receive fresh server props after reload (guide L242–244)**

On a frame reload the clientEntry factory closure is preserved (setup state survives) while the rendered output is rebuilt from the route's current HTML, and `handle.props` holds the fresh server props; fragments are also marked `no-store` (`app/utils/fragment-response.ts`), so a reload is a fresh request. Read changing server values from `handle.props` inside the render function — `app/ui/lazy-frame.browser.tsx:45–79` reads `handle.props.src`/`.name`/`.fallback` there for exactly this reason. Do not snapshot them into factory-scope `let`s: `app/ui/connection-indicator.browser.tsx:36–39` does (`let props = handle.props; let subscriptionUrl = props.url`), so `url`/`reloadMode`/`skipReloadParams` stay at their first-mount values across a frame reload. For data that must be re-fetched when the frame's URL changes, use the `reloadComplete` / `handle.frame.src` path in `references/cliententry-lifecycle.md`. `handle.frames.get(name)` still returns `undefined` for an unmounted frame (guide L242).

## When to Use

- Deciding whether a non-2xx frame response should render in the slot, keep a login redirect, or reject to the app `error` event — or wondering why a frame failure produced no log.
- Reviewing whether returned frame HTML is safe, especially when the frame src or a `data-rmx-src` could be influenced by user input or cross-origin.
- Needing a complete HTML string (email preview or embedded fragment) and reaching for `renderToString`, or considering `renderWith` for a non-standard renderer.
- A `data-rmx-src`/`data-rmx-target` link or a frame form is not intercepted (invalid/cross-origin src, or native validation/submit ordering).
- A clientEntry shows stale server-derived values after a frame reload because props were cached in the factory closure.

## Reference

| Guide section | Lines | Covered here |
| --- | --- | --- |
| Stream a fallback first | L97–114 | fallback is loading UI, not an error boundary; deferred failure keeps it |
| Render the response as a stream | L116–158 | `onError`, `renderWith`, `renderToString`; signal threading |
| Resolve frames in the browser | L160–218 | app resolver choices; same-origin/security rule |
| Name and reload frames | L220–244 | setup state vs fresh `handle.props` after reload |
| Navigate a frame with a form | L246–272 | native validation/submit precede interception; `novalidate` forms |
| Target a frame from a link | L321–344 | `data-rmx-src` same-origin rule regardless of target |
| Handle failures and cancellation | L346–358 | two hooks, resolver choice, deferred failure, `request.signal` |
