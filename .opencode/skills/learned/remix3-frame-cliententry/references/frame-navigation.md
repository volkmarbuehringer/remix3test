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
- `data-rmx-reset-scroll="false"` preserves scroll position.
- Submitter overrides (`formmethod`, `formenctype`, `formtarget`) take precedence.
- The `resolveFrame` client resolver must forward `formData`/`method`/`encType` (see the next section).
- The server action must return a frame fragment (or redirect) so the targeted frame renders correctly.

**Historical root cause (pre-#11668, for legacy builds only):** the Navigation API sets `event.canIntercept === false` for all non-GET navigations, and `getSourceElementNavigation` only read `data-rmx-target` from `<a>`/`<area>` — never from `<form>`. POST validation errors (`POST /admin/resource/:id → 400`) therefore did a full-page navigation, and `renderAdminPage()` without `X-Remix-Target` re-rendered `<Frame src={request.url}/>` against the POST URL → `GET /admin/resource/:id → 404`. On old builds, either render the sidebar directly on POST error paths (no frame wrapper) or use the event-delegation shim below.

<details>
<summary>Legacy pre-#11668 client shim</summary>

Add one delegated `submit` listener on the frame container to catch all its forms:

```typescript
let container = document.getElementById('support-agent-frame-container')
if (container) {
  container.addEventListener('submit', async (e) => {
    let form = (e.target as HTMLElement).closest('form')
    if (!form || form.id === 'support-agent-form') return // skip the agent's own form
    e.preventDefault()
    let method = (form.method || 'GET').toUpperCase()
    let action = form.getAttribute('action') || ''
    let target = form.getAttribute('data-rmx-target')
    let frame = target ? handle.frames.get(target) : handle.frame
    if (!frame) return
    if (method === 'GET') {
      let qs = new URLSearchParams(new FormData(form) as any).toString()
      frame.src = action + (qs ? '?' + qs : '')
      frame.reload().catch(() => {})
    } else {
      await fetch(action, { method, body: new FormData(form) })
      await frame.reload()
    }
  })
}
```

Use `frame.reload()` (re-fetches the frame's `src` through the `resolveFrame` pipeline with the right headers) rather than `frame.replace()` (diffs raw HTML, which breaks when the POST response is a full document). Event delegation beats a per-form `clientEntry`.

</details>

## Client resolveFrame Signature (ResolveFrameOptions)

**Context:** The `entry.tsx` client asset must implement `resolveFrame` (passed via `run({ resolveFrame })`) so the Frame runtime can fetch frame content on the client. This signature is version-pinned and breaking — upgrading the pinned Remix build to post-#11668 requires the options-object form or `npm run typecheck` fails.

Use the options-object signature and build the request body from `options.formData` yourself:

```tsx
import type { FrameContent, ResolveFrameOptions } from 'remix/ui'

async resolveFrame(src, options) {
  return resolveFrameResponse(new URL(src, window.location.href), options)
}

async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<FrameContent | Response> {
  let init: RequestInit = {
    headers: { 'X-Remix-Frame': 'true' },
    signal: options?.signal,
  }
  if (options?.target) init.headers['X-Remix-Target'] = options.target
  if (options?.method && options.method.toLowerCase() !== 'get') {
    init.method = options.method
    init.body = getRequestBody(options.formData, options.method, options.encType)
  }
  // fetch(url, init) → return content fragment or Response (e.g. stream)
}

function getRequestBody(
  formData?: FormData,
  method?: string,
  encType?: string,
): BodyInit | undefined {
  if (!formData || method?.toLowerCase() === 'get') return
  if (encType !== 'application/x-www-form-urlencoded') return formData
  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}
```

Key facts:

- `ResolveFrameOptions` exposes `target`, `formData`, `method`, `encType`, and `signal` — no positional args.
- The runtime does **not** decode `_method`; the `methodOverride()` middleware in `app/middleware/root.ts` stays responsible for that. (Since upstream #11607 the app's hand-rolled `app/middleware/render.tsx` was replaced by the conventional `render({ assets })` from `remix/middleware/render`.)
- Multipart forms pass the raw `FormData`; `application/x-www-form-urlencoded` must be flattened to `URLSearchParams` (the `getRequestBody` pattern above) or the server receives no parsable body.
- Returning a `Response` directly (instead of a `FrameContent` fragment) is the supported path for streaming SSE/agent frames.
- Since #11607 the server `resolveFrame` lives in the conventional render middleware (`@remix-run/render-middleware/dist/lib/render-ui.js`): it forwards `X-Remix-Frame`/`X-Remix-Target`/`X-Remix-Top-Frame-Src`, strips hop-by-hop and `sec-fetch-*` headers, and always re-fetches the frame src with **GET** — `formData`/`method`/`encType` remain client-side `ResolveFrameOptions` concerns only.

Use when `npm run typecheck` reports `ResolveFrame`-related errors after bumping the pinned `remix` build, writing a custom client `resolveFrame`, or debugging missing request bodies on non-GET frame navigations (urlencoded forms silently losing data).

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
to the frame targets that should follow in-frame (admin shell targets: admin-content,
lists-content, workflow/agent-events/support panels). It re-fetches a same-origin
redirect destination as a GET `X-Remix-Frame`/`X-Remix-Target` fragment and returns it,
so the client never sees a 3xx → no bail. Non-admin targets, cross-origin, and the
redirect-depth limit return the redirect unchanged (the client bail handles them).

```ts
// app/middleware/root.ts
createMiddleware(..., render(), json(), frameRedirects())

// app/middleware/frame-redirect.ts
if (context.request.headers.get('X-Remix-Frame') !== 'true' || target == null) return response
if (!ADMIN_FRAME_TARGETS.has(target)) return response        // step-1 scope gate
if (!isRedirectResponse(response)) return response
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

(Version-dependent: the top-frame-only `src` reconcile and the `resolveFrameResponse` redirect bail are remix/ui runtime behavior — re-check against the pinned vendor source before relying on it.)
