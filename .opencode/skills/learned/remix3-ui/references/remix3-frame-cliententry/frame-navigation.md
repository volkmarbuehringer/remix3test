# Frame Navigation, Forms, and Redirects

## What This Covers

The frame-navigation contract and its escape hatches. Read this when the task involves:

- The always-loaded client runtime and what removing `entry.tsx` actually changes
- Rendering a route differently inside a frame to avoid a double-load crash
- Form submissions in frames on post-#11668 builds and the `data-rmx-*` form attributes
- The client `resolveFrame(src, options)` signature and building non-GET request bodies
- `data-rmx-document` escapes for binary downloads and cross-section links
- `data-rmx-history` push/replace control
- Nested-frame POST/redirect/GET and the `frameRedirects()` middleware

For the entry's mount lifecycle, see `cliententry-lifecycle.md`. For frame-target wiring, see `frame-layout-and-testing.md`.

## Client Runtime Is Always Loaded

`app/assets/entry.tsx` (which calls `run({ resolveFrame })`) is **not** user code you toggle per page — it is the framework client runtime, and `app/ui/document.tsx` injects its `<script>` on **every** `Document` page, including pages rendered through plain `Layout` (which also passes through `Document`). Consequences:

- The frame-navigation interception, DOM swap, and hydration/reconciliation engine are **always present** once any page loads — even if that page has zero `clientEntry` components. SSR renders the full HTML; the runtime merely enhances it.
- Removing `entry.tsx` (from a page or from the asset pipeline) does **not** make that page "more SSR" — it reverts it to a no-JS page where forms/links fall back to full-document navigations (native browser behavior). Only client enhancement is gone; the server render is unchanged.
- "SSR vs client" is therefore not a global toggle. SSR is the default render path for every request; `clientEntry`/frame-nav are opt-in enhancements layered on top. Reserve `clientEntry` for genuine UX gaps (live regions, drag, focus management after swap), not SPA-style rendering.
- For cross-boundary transitions where the frame runtime must NOT intercept (uploads, downloads, login, public booking, cross-section links), use `data-rmx-document` (below) — do not disable the runtime.

## Frame Direct Render — Avoid Double-Load Crash

**Context:** A route living inside a Remix 3 `<Frame>` must render differently depending on how it is reached, or it will produce a nested Frame shell that crashes the browser.

When a Remix 3 route is backed by a `<Frame>` (via `ShellOrFragment` in a sidebar layout), a full-page GET renders `<Frame src={url} />`. The Frame then fetches the same URL. On the second request, `ShellOrFragment` detects `X-Remix-Target` and returns just the content fragment. But this double-load (shell → Frame fetch) can crash the browser when the route has heavy rendering, inline scripts, or complex state — the outer shell loads resources, then the Frame loads duplicate resources.

Branch in the route's `index` action: detect whether the request is a frame fragment (has `X-Remix-Target`), and if not, render the full page directly without going through `ShellOrFragment`'s Frame wrapper.

```tsx
import { Layout } from '../../ui/layout.tsx'
import { AdminLayout, renderAdminPage } from '../../ui/admin-layout.tsx'
import { frames } from '../../routes.ts'

async index(context) {
  // ... load data ...

  let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
  if (isFrameRequest) {
    // Fragment mode: just the content (sidebar + page) — used by data-rmx-target navigation
    return renderAdminPage(context.render, 'support',
      <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
    )
  }
  // Full page mode: no Frame wrapper — avoids double-load crash
  return context.render(
    <Layout>
      <AdminLayout activeItem="support">
        <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
      </AdminLayout>
    </Layout>,
  )
}
```

Use when a route rendered inside a `<Frame>` with `data-rmx-target` navigation crashes/slows or duplicates resources on full-page navigation.

## Form Submissions in Frames (post-#11668)

**Context:** Migrating a render-on-error CRUD form into the admin sidebar Frame. Historically, form validation errors caused 404 GETs because the 400 HTML response created a `<Frame>` that fetched the POST URL.

**Version alert:** As of `fa6e26f90` (#11668, merged to upstream main 2026-08-12), POST forms are **intercepted by the Frame runtime like links** when `run({ resolveFrame })` is active. Make the server-rendered form frame-aware; no client-side code is needed.

```tsx
// Non-GET form: reloads the referenced frame with the submitted data
<form method="post" action="/resource" data-rmx-target="lists-content">
  <CsrfTokenInput />
  <input type="hidden" name="_method" value="DELETE" />
  {/* ... fields ... */}
  <button type="submit">Delete</button>
</form>

// GET form (filter/search): behaves like a link — browser serializes
// successful controls into the destination URL, frame reloads natively
<form method="get" action="/list" data-rmx-target="lists-content">
  <input name="q" />
  <button type="submit">Search</button>
</form>
```

Key facts (post-#11668):

- `data-rmx-document` opts the form back out to a normal document navigation.
- `data-rmx-src="/frame"` overrides the URL resolved into the frame while the form `action` stays the navigation destination.
- `data-rmx-reset-scroll="false"` preserves scroll position on push/replace. Since #11989 it does not survive traversal (Back/Forward forces `after-transition`), and the runtime reset still only scrolls the document — see `remix3-css-and-layout` → `nested-scroller-navigation-reset.md` for nested containers.
- Submitter overrides (`formmethod`, `formenctype`, `formtarget`) take precedence.
- The `resolveFrame` client resolver must forward `formData`/`method`/`encType` (see the next section).
- The server action must return a frame fragment (or redirect) so the targeted frame renders correctly.

### Detached submitters: #11987 is Chromium-only on this build (Firefox fires `formdata` at AT_TARGET)

#11987 ("resolve form navigation when submitter is detached before navigate fires"; installable build `48b54a55`) indexes pending submissions by form **and** submitter, so `getSourceForm` can resolve a button whose `.form` is `null` once it has been detached. The submitter index is populated inside `onFormData`, guarded by `if (event.eventPhase !== Event.NONE || event.defaultPrevented) return` — the intent is to ignore `formdata` snapshots taken by user submit handlers.

Firefox (Playwright build 142, 2026-10-15) fires the native `formdata` event while the `submit` event is still at **AT_TARGET (eventPhase 2)**, so the guard discards the snapshot, `pendingSubmissions` stays empty, and a detached-submitter GET form falls through to a full document navigation. Probe evidence: a `formdata` listener sees `{ phase: 2, defaultPrevented: false, submitterIsButton: true }`, `navigate` fires with `sourceElement: button, canIntercept: true`, and the document navigates anyway; the attached-submitter control stays in-frame in both engines. App impact: a Firefox form submitted through a removed/temporary submitter does a full page load. Guard: `app/actions/admin/frame-form-detached-submitter.test.e2e.ts` (Chromium asserts the in-frame reload; Firefox is a smoke check, scoped with `isFirefox()` like `agent-events-frame-redirect.test.e2e.ts`).

## Client resolveFrame Signature (ResolveFrameOptions)

**Context:** The `entry.tsx` client asset implements `resolveFrame` (passed via `run({ resolveFrame })`) so the Frame runtime can fetch frame content on the client. This signature is version-pinned and breaking — upgrading the pinned Remix build to post-#11668 requires the options-object form or `npm run typecheck` fails.

**Since the `b4a0aa9a` pin the app delegates request construction to `defaultResolveFrame` (remix #12249).** `app/assets/frame-response.browser.tsx` calls `defaultResolveFrame(url.href, options, { fetch })`; the vendor default owns form encoding, `Accept`, `X-Remix-Frame`/`X-Remix-Target`, `Content-Type`, `same-origin` mode, hash stripping, and 5xx/non-HTML-3xx/4xx rejection. The app-only policy lives in the `fetch` override (one-shot `X-Agent-Prefill`, `cache: 'no-store'`) and in the exported `classifyFrameResponse(response, { target, mode })`, which is total over every response:

| Response | Navigation outcome | Prefetch outcome |
| --- | --- | --- |
| `redirected` + target | `document-navigation` (`window.location.assign(response.url)`) | `navigated` (no side effect) |
| `401` (any body) | `login` | `navigated` |
| `5xx` (any body) | `recovery-card` | `navigated` (never warmed) |
| HTML `3xx`/`4xx` | `render` | `render` (validation fragments are warmable) |
| 2xx non-HTML, or non-HTML `3xx`/`4xx` | `non-html-error` (console report + card) | `navigated` |
| 2xx HTML / missing Content-Type | `render` | `render` |

Key facts:

- **`defaultResolveFrame` rejects before the app policy can see the response.** It throws a plain `Error` for every `5xx` and every non-HTML `3xx`/`4xx`, carrying only status/statusText. The app's `fetch` override keeps a reference to the response it returned, and the `catch` calls `classifyFrameResponse` on that captured response. Fixing this by parsing the error message would be fragile; keep the capture.
- **A rejecting response is already fetched but not consumed.** Returning the recovery card or error card discards it; do not return that `Response` as frame content.
- **Prefill consumption stays app-owned.** The header is injected in the `fetch` override (base64 JSON). It is deleted after an accepted `response.ok` navigation only; a prefetch and every 4xx/5xx keep it for the real navigation.
- **Cross-origin *sources* still document-navigate** via `isSameOriginFrameSource` before delegation. Cross-origin *redirects* are now rejected by the vendor's `same-origin` fetch mode (a network error surfaced on the runtime error channel) instead of being followed when CORS allowed it. No app route redirects a frame cross-origin; the redirects that matter (`/auth/login`, cross-section PRG) stay same-origin and still hit the `response.redirected` bail.
- `ResolveFrameOptions` exposes `target`, `formData`, `method`, `encType`, `signal`, and `transition` — no positional args.
- The runtime does **not** decode `_method`; the `methodOverride()` middleware in `app/middleware/root.ts` stays responsible for that. (Since upstream #11607 the app's hand-rolled `app/middleware/render.tsx` was replaced by the conventional `render({ assets })` from `remix/middleware/render`.)
- Returning a `Response` directly (instead of a `FrameContent` fragment) remains the supported path for streaming SSE/agent frames; the error-card outcomes still return `FrameContent`.
- Since #11607 the server `resolveFrame` lives in the conventional render middleware (`@remix-run/render-middleware/dist/lib/render-ui.js`): it forwards `X-Remix-Frame`/`X-Remix-Target`/`X-Remix-Top-Frame-Src`, strips hop-by-hop and `sec-fetch-*` headers, and always re-fetches the frame src with **GET** — `formData`/`method`/`encType` remain client-side `ResolveFrameOptions` concerns only.

Tests: `app/assets/frame-response.test.browser.ts` covers delegation (headers/mode/URL), encoding parity, the 401/5xx/4xx/prefetch table on `classifyFrameResponse`, prefill injection/consumption, and the never-settling navigated outcomes.

Use when `npm run typecheck` reports `ResolveFrame`-related errors after bumping the pinned `remix` build, writing a custom client `resolveFrame`, debugging missing request bodies on non-GET frame navigations (urlencoded forms silently losing data), or when the resolver's encoding drifts from the runtime default after a pin bump.

## Same-Document View Transitions Around Frame Commits — `defaultResolveFrame` Commit Hook

**Context:** Wrapping a frame swap (`frame.reload()`, link/form navigation) in `document.startViewTransition()` so changed rows/cards cross-fade or move. Checked 2026-11-13 against the installed preview release `v0.20261113.180701-main-b4a0aa9a` (source `b4a0aa9a`; `@remix-run/component` 1.2.0).

The public `FrameHandle` surface still exposes only `src`, `reload()`, `replace()`, and two lifecycle events (`remix/src/component/README.md` § Frame Handles):

- `reloadStart` — dispatched from `transitionLoad`'s `start` case when a direct reload begins, before the fetch (`@remix-run/component/src/runtime/frame.ts:893`); inherited reloads dispatch in `startInheritedReload` at `:1183` (defined at `:1157`).
- `reloadComplete` — dispatched after reconciliation settles, including cancellation/failure (`:1154`, inherited at `:1196`).

Initial lazy-frame viewport loads and viewport retries do **not** dispatch a `reloadStart`/`reloadComplete` pair; only explicit and ancestor-driven reloads do (see `references/remix3-frame-cliententry/lazy-frames.md`).

Lifecycle events still cannot bracket the DOM commit, but since **#12249** there is a supported commit hook — on `defaultResolveFrame`, not on `FrameHandle`/`reload()`:

- `defaultResolveFrame(src, options?, overrides?)` is exported from `remix/component`; `overrides.commit(commitFrame, { to, response, signal })` wraps rendering. `commitFrame()` starts the default commit once and resolves after the update, including history URL, scroll, focus, and followed redirects. Wrap it in `document.startViewTransition(commitFrame)` for a same-document transition.
- `to` is the resolved destination after redirects; `options.transition` still describes the original navigation. The callback's `signal` covers cancellation/supersession; a callback that returns or throws without calling `commitFrame()` falls back to the default commit, and callback errors reach the runtime's error channel.
- Return the response directly from the resolver: the callback is keyed by that `Response` identity, so cloning or replacing it loses the callback. The body stays streamed; navigation may finish while the wrapper awaits an animation.
- Starting the transition on `reloadStart` is still wrong (the snapshot predates the response), and `startViewTransition(async () => { await frame.reload() })` still holds the update phase for the whole request.
- A `MutationObserver` around the frame subtree remains rejected: it re-enters for unrelated mutations, has no ordering guarantee against reconcile, and produces duplicate/partial snapshots.

**App implementation (since the `b4a0aa9a` pin):** `app/assets/frame-response.browser.tsx` now delegates to `defaultResolveFrame(..., { fetch, commit })`, so the commit hook is live. `app/assets/frame-transition.browser.ts` owns the single animated flow:

- **Candidate:** admin lists grid ⇄ edit/create panel (`/admin/lists`, target `admin-content`). The URL toggles an `editing`/`creating` parameter, so `shouldAnimateAdminListsPanel(options, to)` compares `options.transition.from.url` with `to`. Pagination, filter/search, reload, form saves (same panel parameter), other frame targets, and independent reloads stay instant. `createAdminListsPanelCommit` only attaches the callback for a navigation-driven `admin-content` load.
- **Scoping:** `app/ui/admin-lists-page.tsx` marks both root branches with `data-frame-transition-region="admin-lists"` (constant contract in `app/utils/frame-transition.ts`; it is server HTML, so it exists in both snapshots). The callback sets `view-transition-name: admin-lists-content` on the one region immediately before `startViewTransition()` and re-applies it inside the update callback after `commitFrame()` (the new root is a re-created node). It removes the name when the transition settles, guarded by an `activeTransition` token so a superseded transition cannot clear a newer one's name.
- **Scoped root:** `app/ui/document.tsx` hides `::view-transition-old(root)`/`new(root)` only under `html[data-frame-transition]`, which the callback sets immediately before starting and removes when settled. Without it the whole viewport cross-fades; with it the unchanged header/sidebar keep painting. The attribute is set only after the `prefersReducedMotion()` and API checks, so reduced-motion users never see a partially applied gate.
- **No stall:** the update callback starts `commitFrame()` first, then awaits it before the new snapshot; the callback's trailing `await viewTransition.finished` is post-commit work the runtime does not wait for (`commitFrameResponse` races `started`). `signal` abort calls `skipTransition()`; `ready` is observed to avoid an unhandled rejection. A missing or ambiguous region (not exactly one) and a refused `startViewTransition` both fall back to a plain commit exactly once.
- **Feature gate is the API, not the engine.** Playwright Firefox 142 reports `document.startViewTransition` and `CSS.supports('view-transition-name: root')`, so same-document frame transitions run there too; cross-document `@view-transition` remains Chromium/WebKit-only. Do not engine-gate the commit hook.

Tests: `app/assets/frame-transition.test.browser.ts` (decision matrix, every fallback, name cleanup, no-stall with a never-resolving `finished`) and `app/actions/admin/lists/lists-frame-transition.test.e2e.ts` (real runtime: one transition per grid ⇄ editor swap, no document load, cleanup after settle).

Never reach into the internal `onCommit` (`frame.ts:1116`), which is not exported; use the exported commit override.

Status: one flow is animated; everything else stays instant by design.

## data-rmx-document: Binary Downloads & Cross-Section Links

**Context:** Links inside Frame contexts to binary download endpoints or to a different Frame-relay section crash or freeze the browser when the frame router intercepts them.

Remix's frame router intercepts `<a>` clicks, fetches the URL with `Accept: text/html` + `X-Remix-Frame: true`, and parses the response as a component tree. Two failure modes:

1. **Binary download → DOM crash**: Clicking a link to a PDF/CSV/ZIP endpoint makes the router try to mount the binary response as HTML, producing `Node.insertBefore: Cannot insert a Text as a child of a Document`. The same URL works on reload because full-page navigation skips the frame router.
2. **Cross-section link → 100% CPU loop**: A plain `<a>` navigating to a different Frame-relay section triggers a frame-resolution loop (destination returns another `<Frame>`, which resolves to another...). Symptoms: server returns 200 for all requests, the tab pegs at 100% CPU and freezes, clientEntry data fetches never fire.

The `data-rmx-document` attribute tells the Remix navigation runtime to skip frame interception for that link (`navigation.ts: if (linkElement.hasAttribute('data-rmx-document')) return`), forcing a normal document-level navigation:

```tsx
<a href={routes.export.pdf.index.href()} data-rmx-document>PDF herunterladen</a>

<a href={`/lists?load=${row.id}`} target="_top" data-rmx-document>{row.description}</a>
```

### Guard the controller against frame requests

If the URL is reached directly while inside a frame, the request still carries `X-Remix-Frame: true` — **do not bare-redirect to the same URL**. `fetch()` preserves custom headers across same-origin redirects, so the frame fetch re-requests with `X-Remix-Frame: true` and the controller 302s again: the chain loops until the browser aborts (~20 hops → `NetworkError when attempting to fetch resource`), with the `frameRedirects()` middleware depth-follow stacking ~10 more server-side requests per browser hop. Seen in production 2026-08-30 on `/verwaltung/users-export`; `users-pdf` still ships the latent loop.

The client bail (`frame-response.browser.tsx`: `if (response.redirected && options?.target) window.location.assign(response.url)`) only fires when the frame fetch has an `X-Remix-Target`. Top-frame resolutions (links/forms without `data-rmx-target`) never bail — they render whatever HTML the fetch returns.

Safe shim: redirect once to a **marker URL** whose handler renders HTML when framed (terminating the chain) and the binary when not:

```tsx
const MARKER = 'frameDownload'
async index(context) {
  let url = new URL(context.url)
  if (hasDownloadParams(url)) {
    if (context.request.headers.get('X-Remix-Frame') === 'true') {
      if (url.searchParams.get(MARKER) === '1') {
        return renderPageFragment(...)          // terminates the chain
      }
      url.searchParams.set(MARKER, '1')
      return redirect(url.href)                 // one hop only
    }
    return downloadPdf(context, url.searchParams)
  }
  return renderPageFragment(...)
}
```

Target-ful frame clients then bail to a full-page navigation of the marker URL (no frame headers → binary downloads); target-less fetches degrade to rendering the page fragment. For the download trigger itself, prefer `data-rmx-document` **on the form** (as of #11668 forms are intercepted like links): native navigation hands the attachment to the browser's download manager without leaving the page — no shim needed on the happy path.

**Since #11940** the browser navigation listener also steps aside when `event.downloadRequest != null` and for hash-only changes (`event.hashChange` with no pending frame reload) (`@remix-run/component` `src/runtime/navigation.ts`, `startNavigationListener`). A link carrying the native `download` attribute therefore needs no `data-rmx-document`; the escape is still required for an attachment endpoint reached by a plain link or form with no `download` attribute. Also, a hash-only change no longer triggers a frame reload, so in-frame `#fragment` deep links are handled entirely by the browser.

### Conditionally apply `data-rmx-document` in shared navigation

For components rendered across sections (e.g., MainNav), apply `data-rmx-document` only when the destination section differs from the current section. This preserves fast frame-based navigation within the same section:

```typescript
let currentPath = new URL(getContext().request.url).pathname

let isCrossSection = (href: string) => {
  if (!currentPath || !href || href === '/') return false
  let linkSection = href.split('/')[1] || ''
  let currentSection = currentPath.split('/')[1] || ''
  return linkSection !== currentSection
}
```

```tsx
<a href={item.href} {...(item.href && isCrossSection(item.href) ? { 'data-rmx-document': '' } : {})}>
  {item.label}
</a>
```

## data-rmx-history Attribute — push vs replace

**Context:** Controlling how a Frame or form navigation updates the browser's history entry, added in `b23ecbed2` (#11670, merged upstream 2026-08-12).

`data-rmx-history="push" | "replace"` on `<a>`/`<form>` overrides the runtime's default history behavior. Resolution order lives in `navigation.ts` `getReplaceHistory`:

- `data-rmx-history="replace"` → `replaceHistory = true`
- `data-rmx-history="push"` → `replaceHistory = false`
- **No attribute** → the runtime default:
  - Links: `false` (push)
  - Non-GET forms whose destination equals the current URL: `true` (replace — avoids a duplicate entry); if a form submission targets a different URL it pushes
  - GET forms behave like links (values live in the URL)

The `link` mixin exposes the same control as `link({ history: 'replace' })`, and the attribute is accepted on both anchors and forms in `dom.ts` (`PartialAnchorHTMLProps`/`FormHTMLProps`).

For a `<form method="post" data-rmx-target="...">` whose action equals the current frame URL, the runtime already replaces the history entry by default — a server 302 redirect loop (PRG) won't stack history entries. Use `data-rmx-history="push"` if you intentionally want the destination to occupy a new entry.

Verification: see `b23ecbed2` — `packages/ui/src/test/navigation.test.ts` asserts `replaceHistory` outcomes for both explicit and attribute-driven cases.

### Interrupted pushes replace their unrendered entry (#12240)

**Since #12240** `startNavigationListener` records the key of a push entry that committed before its page rendered. When another navigation interrupts it — a second link click, form submit, or `navigate()` — the interrupting navigation replaces that entry instead of pushing a second one, so Back returns to the page the visitor actually saw. Without this, an interrupted push leaves a history entry for a URL that never rendered.

**Since #12248** that bookkeeping is an explicit coordinator (`createNavigationCoordinator`, `navigation.ts:634`) with `operation`, `frameWork`, `entry`, and `push` states instead of the ad-hoc `needsFrameReload`/`unrenderedEntryKey`/`uncommittedPushFromKey` flags. The coordinator fixes a reentrancy hole: a `currententrychange` listener that starts another navigation while Remix updates the current history entry no longer starts a stale frame reload. It also reuses an unrendered history slot across repeated interruptions and preserves a rendered page in history before its response stream finishes. App call sites are unchanged; `lists-frame-history.test.e2e.ts` covers the interrupted-push contract.

The same commit routes `data-rmx-history="replace"` links and GET forms through the Navigation API precommit path where it exists: `precommitHandler` calls `NavigationPrecommitController.redirect(url, { history: 'replace' })`, replacing the in-flight entry before commit. POST forms already did this; browsers without `NavigationPrecommitController` keep the `preventDefault()` + replace-`navigate()` fallback. With precommit the navigation is redirected rather than cancelled, so a replace-mode `navigate()` promise settles instead of rejecting solely because the entry was replaced.

App checks: the five GET filter forms carrying `data-rmx-history="replace"` (admin lists/users/messages, client grid, settings) and `app/actions/scroll-restoration/public/scroll-restoration.tsx`'s replace-mode `navigate()`. `app/actions/admin/lists/lists-frame-history.test.e2e.ts` holds an editor response open, interrupts it with a second row, and asserts no history entry for the first URL plus a Back return to the grid (Chromium).

## Post-Form PRG Redirects in Nested Frames — Bail vs. Stale src

**Context:** A grid CRUD form (e.g. activate/deactivate a user) posts inside a nested agent panel frame (agent-events-panel / workflow-agent-panel). The controller redirects (PRG). Two distinct failure modes.

### Failure 1 — Redirect bail tears down the host

`resolveFrameResponse` (`app/assets/frame-response.browser.tsx`) does
`if (response.redirected && options?.target) window.location.assign(response.url)`.
A frame-targeted form POST's browser `fetch` follows the 302 → `response.redirected`,
so the client performs a **top-level** navigation to the redirect destination. When the
host page is `/admin/agent-events` and the destination is `/admin/users?…`, the whole
host "agent dialog" disappears.

**Fix:** wire a server-side `frameRedirects()` middleware into the router stack, scoped
to the frame targets that should follow in-frame (admin-content, lists-content,
agent-events-panel, support-agent-panel, settings-panel, appointments-new-content) and
only when the destination stays inside the request's top-level URL section. It
re-fetches a same-origin redirect destination as a GET `X-Remix-Frame`/`X-Remix-Target`
fragment and returns it, so the client never sees a 3xx → no bail. Cross-section
destinations (e.g. settings' delete-account → `/auth/login`), cross-origin targets, and
the redirect-depth limit return the redirect unchanged (the client bail handles them).

It must run **outside** `session()`: the session middleware persists a flash only when
the outer response unwinds, so a follow inside it re-reads the pre-redirect session and
drops every in-frame PRG flash. The memory test store does not mask this (it snapshots
`session.data`); tests that only inspect the saved flash did. Because the reorder puts the
follow after the redirect's session save, the follow must also inherit the redirect's
`Set-Cookie` (session ids can rotate) and re-emit it on the final response.

```ts
// app/middleware/root.ts — outside session()
createMiddleware(..., frameRedirects(), session(cookie, storage), ...)

// app/middleware/frame-redirect.ts
if (context.request.headers.get('X-Remix-Frame') !== 'true' || target == null) return response
if (!IN_FRAME_REDIRECT_TARGETS.has(target)) return response
if (!isRedirectResponse(response)) return response
if (!sameSection(context.url, destination)) return response
// re-fetch destination as a frame GET fragment → return it
```

### Failure 2 — Stale frame src → 404 after the in-frame redirect

After the in-frame follow, `navigation.ts` sets `frame.src = state.src` — the **POST
action URL** (e.g. `/admin/users/2/toggle-disabled`). `redirectedTo` is only populated
when the response is marked `redirected` (it isn't — the middleware returned a 200
fragment), and the runtime only reconciles `frame.src` for the **top** frame
(`if (redirectedTo && frame === topFrame)`). So a nested subframe keeps the POST URL as
its `src`, and a later `frame.reload()` (e.g. the agent `workflow-finish` reload) does a
GET on a POST-only route → **404 / "Not Found"**.

**Fix:** the middleware reports the destination (`X-Remix-Redirect-To` header) and the
client `resolveFrame` (`app/assets/entry.tsx`) reads it and sets the target frame's
`src` to the destination:

```ts
// app/middleware/frame-redirect.ts — on the returned fragment
frameResponse.headers.set('X-Remix-Redirect-To', destination.href)

// app/assets/entry.tsx — inside run({ resolveFrame })
if (result instanceof Response) {
  let dest = result.headers.get('X-Remix-Redirect-To')
  if (dest && options?.target) {
    let frame = app.frames.get(options.target)
    if (frame) frame.src = dest
  }
}
```

### Vendor constraints

- `data-rmx-src` does **not** fix this for POST forms: the resolver fetches `frame.src`
  (not the form `action`), so pointing it at the grid URL would send the POST to the
  wrong URL. It only works for links.
- The runtime only reconciles `frame.src` on redirect for the top frame; nested
  subframes must be reconciled by the app.
- Server-side grid tests do not send `X-Remix-Frame`/`X-Remix-Target`, so wiring
  `frameRedirects()` will not disturb them — only the browser frame path changes.
- Verify with a router-level test that the in-frame follow returns a `200` fragment (not
  a bare `302`) carrying `X-Remix-Redirect-To`, plus a browser e2e driving the
  confirm-gate → resume → reload path (no 404).

(Version-dependent: the top-frame-only `src` reconcile and the `resolveFrameResponse` redirect bail are remix/component runtime behavior — re-check against the pinned vendor source before relying on it.)
