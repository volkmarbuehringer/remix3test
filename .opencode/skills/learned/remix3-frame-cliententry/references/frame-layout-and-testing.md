# Frame Layout and Testing

## What This Covers

Frame layout wiring and how to verify frame-rendered output. Read this when the task involves:

- Embedding a nested `<Frame>` panel inside a sidebar-layout page
- Registering frame targets as content-only vs full-shell
- A `<Frame>` reload ignoring a server-rendered `<input defaultValue>`
- Asserting on a frame-rendered fragment in a server test without a browser

For the navigation/forms contract, see `frame-navigation.md`. For the entry lifecycle, see `cliententry-lifecycle.md`.

## Frame Target Registration & Content-Only Panels

**Context:** Moving admin agent routes under `/admin` with a sidebar, embedding a nested "panel" frame that loads other admin pages. Two symptoms appeared in sequence: a duplicate MainNav navbar in the panel, then a duplicate sidebar.

A `<Frame name="X" src="/path">` fetches its content with `X-Remix-Target: X`. The sidebar layout (`createSidebarLayout`/`ShellOrFragment`) only renders a **fragment** when the incoming `X-Remix-Target` is in its registered set (`frameTarget` + `acceptFrameTargets`), or in `contentOnlyTargets` (which renders bare page content).

Three failure modes:

1. **Unregistered target → duplicate navbar**: Load `/admin/users` into a frame named `agent-events-panel`. The request carries `X-Remix-Target: agent-events-panel`, which isn't accepted → `isFrameRequest()` is false → `ShellOrFragment` renders `<Layout><Frame name={frameTarget} src={url}/></Layout>` (the frame target defaults to the top frame), so the full page (`Layout` with public `MainNav`) renders INSIDE the panel → a second navbar, because the URL re-enters the `admin-content` frame.
2. **Registered target → duplicate sidebar**: If you "fix" mode 1 by adding the panel name to `acceptFrameTargets`, the admin fragment includes the sidebar shell → the panel now shows a second sidebar (the host page already renders via `renderAdminPage` with the sidebar on the left).
3. **Frame-name collision**: `getNamedFrame(name)` resolves within the current document's runtime and falls back to the top frame. If a page living inside the `admin-content` frame embeds another frame ALSO named `admin-content`, sidebar `NavLink`s (target `admin-content`) resolve to the inner panel instead of the page frame.

### Solution

#### Centralize frame names

Keep every frame name in one `frames` const so the `<Frame name>`, `data-active-frame`, SSE navigate targets, and the layout's target lists cannot drift:

```tsx
// app/routes.ts
export const frames = {
  adminContent: 'admin-content',
  listsContent: 'lists-content',
  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',
  workflowAgentPanel: 'workflow-agent-panel',
  agentEventsPanel: 'agent-events-panel',
} as const
```

#### Register panel targets as content-only

`createSidebarLayout` gained a `contentOnlyTargets` set. When `X-Remix-Target` matches one, `ShellOrFragment` returns just the page content (`children`) — no sidebar shell, no `Layout` shell:

```tsx
export type SidebarLayoutConfig<ID extends string> = {
  frameTarget: string
  acceptFrameTargets?: string[]
  contentOnlyTargets?: string[]   // render only children for these targets
  // ...
}

// ShellOrFragment
let target = getContext().request.headers.get('X-Remix-Target')
if (target != null && contentOnlyTargetSet.has(target)) {
  return children
}
```

Register the panel names as content-only (NOT as full-shell accepted targets):

```tsx
createSidebarLayout<AdminNavItem>({
  frameTarget: frames.adminContent,
  acceptFrameTargets: [frames.listsContent],
  contentOnlyTargets: [frames.agentEventsPanel, frames.workflowAgentPanel],
  // ...
})
```

#### Use unique names for nested panels

A frame nested inside the `admin-content` frame must have a DIFFERENT name than `admin-content`. Otherwise sidebar navigation (target `admin-content`) hits the inner panel frame.

#### Prefer panel navigation over whole-page navigation when streaming continues

If an action navigates the panel AND then continues streaming a workflow result into the same SSE connection, do NOT navigate the whole page — that tears down the connection and loses the result. Navigate the panel frame and let it reload on completion.

Use when embedding a nested `<Frame>` (panel) inside a page that already renders a sidebar layout, after changing a frame's `name`/`data-active-frame`/SSE navigate `target`, seeing a second navbar or second sidebar inside a frame, or sidebar navigation jumping into the wrong (inner) frame.

### A nested `<Frame>` inside a fragment-hydrated frame never registers

**Context:** Building a master–detail view — a list page inside the `admin-content` frame that embeds a second `<Frame name="admin-chatlog-detail">` pane, with row links carrying `data-rmx-target="admin-chatlog-detail"`.

**Symptom:** clicking a row ignores the target and replaces the WHOLE document. The network entry carries `X-Remix-Target: undefined` (not the pane name), and the outer page's DOM — list and all — is gone.

**Cause (verified against the pinned `remix` build in this repo):**

- `admin-content` renders with a `fallback`, so it is a **non-blocking** frame: the root document ships only `<!-- rmx:f:id -->` plus a template, and the frame's real content arrives from a second fetch and hydrates through `frame.ts`'s `resolveAndRenderReload` → fragment render path.
- That path builds a `responseContext` from the fragment's own `rmx-data` (the one naming the nested frame) and calls `createSubFrames`, but the nested marker never ends up registered in the runtime's `namedFrames` map. `handle.frames.get('<nested-name>')` returns `undefined` in a `clientEntry`'s `queueTask` — and still does seconds later.
- `getNamedFrame(name)` in `navigation.ts` resolves against that map and falls back to `topFrame` (`let frame = namedFrame ?? topFrame`), so the row link navigates the top document. That is the `X-Remix-Target: undefined` you see — the header is only set when the lookup succeeded.

**Rule:** a nested `<Frame>` must be present in the **server-rendered** response of the frame that hosts it. Never mount it conditionally from client state, and never rely on one appearing in a fragment a parent frame fetches afterwards — if the pane's `<Frame>` only renders once a selection exists, the selection can never be made.

**Working shape** (`app/ui/admin-chatlog-page.tsx` + `app/ui/admin-chatlog-detail.browser.tsx`):

```tsx
// Always rendered, even with nothing selected: the frame source points at an
// invalid id so the endpoint answers with its empty state and loads no messages.
<Frame
  name="admin-chatlog-detail"
  src={routes.admin.chatlog.fragments.detail.href({ id: 'none' })}
  fallback={<div>Konversation wird geladen…</div>}
/>
```

Then drive that frame directly from the entry — `frame.src = href; frame.reload()` on click — rather than through `data-rmx-target` on the row links, and keep the `href` on the link for the no-JS fallback.

**Two follow-on traps this exposes:**

1. **The handle resolved at setup can be replaced.** `handle.frames.get(name)` inside `queueTask` may return a handle whose `reloadComplete` never fires for later loads (verified: the listener never ran for a pane that demonstrably updated). Drive focus/settle logic off a `MutationObserver` on the pane DOM instead of the handle's events.
2. **A repeated identical fragment produces no mutation.** When a pane already shows the same "not found" fragment (a remembered selection whose thread was deleted), re-rendering it changes nothing in the DOM, so an observer-only settle check never runs and the dead pane stays open. Call the settle check explicitly after the reload promise you awaited, in addition to the observer.

**Validated:** 2026-09-11 in `/home/lucky/remix3test` with Playwright (frame request header, two-column layout, persistence across reload, stale-selection collapse).

Use when a nested `<Frame>`'s `data-rmx-target` silently navigates the whole document, `X-Remix-Target` is undefined on a frame request, `handle.frames.get('<name>')` returns undefined for a frame visible on the page, or a client-mounted frame pane never loads.

## Frame Input Value Preservation

**Context:** When a Remix Frame reloads with new server-rendered HTML containing `<input value="...">`, the `defaultValue` is silently ignored. The input keeps its previous value (or stays empty).

Remix Frames use DOM reconciliation when updating content on `frame.reload()`. When an `<input>` element is reused, the reconciliation skips the live `value` update (the `shouldPreserveInputValue`/diff behavior), so the server-rendered `defaultValue` is never applied. This affects filter/search inputs with `defaultValue={filterParam}` on Frame-reloaded pages, any form input that relies on `defaultValue` inside a Frame, and GET form submissions with `data-rmx-target` that navigate the frame.

**Solution — set `.value` directly after the frame reload completes**, bypassing the diff:

```typescript
function restoreFilterValue(url: string) {
  let filterValue = new URL(url, window.location.origin).searchParams.get('filter') ?? ''
  for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
    input.value = filterValue
  }
}

// In handleNavigate:
frame.src = href
frame.reload().then(
  () => restoreFilterValue(href),
  (err) => handleError(err),
)
```

For values that should persist across navigations (e.g. the user's last search), store the value and restore it when no URL parameter is present:

```typescript
let lastFilterValue: string = ''

function restoreFilterValue(url: string) {
  let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
  if (filterValue !== null) {
    lastFilterValue = filterValue
  }
  let value = filterValue ?? lastFilterValue
  for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
    input.value = value
  }
}
```

For the frame's `handleFrameFormSubmit` GET handler, apply the same pattern after `frame.reload()`.

### Corrected mechanism (this fork) + the simpler clear/reset fix

The older `diff-dom.js`/`shouldPreserveLiveAttribute` description predates this fork. `remix 3.0.0-beta.10` (github:remix-run/remix#preview/main, pinned in `node_modules/remix`) reconciles frame content with its own runtime at `@remix-run/ui` `src/runtime/reconcile.ts` + `core/props.ts`:

- `diffVNodes(curr, next)` reuses an existing host DOM node whenever `curr.kind === next.kind && curr.type === next.type` — it **ignores `key`**, so putting `key={...}` on an `<input>` to force a remount does **not** work.
- `patchHostProps` skips a prop when `prevValue === nextValue` and only sets the `defaultValue` **property** (not the live `.value`) on change, so the displayed value isn't restored either.

**Net effect:** after a frame navigation that re-renders an uncontrolled `<input defaultValue={...}>` with a *different* value (e.g. clearing a filter to `''`), the input reuses its DOM node and keeps its old text. Verified empirically (`sameNode === true`, stale `value` attribute).

**Simplest reliable fix — full-page navigation for clear/reset.** Instead of a client-side restore, make "clear"/"reset" a plain `<a href>` with **no `data-rmx-target`** (as `/admin/clients` already does). The browser does a full document load, so every input mounts fresh with the server's new `defaultValue`:

```tsx
{/* Frame SPA nav — input keeps its old text */}
<a href={base} data-rmx-target={getSelfFrameTarget()}>Zurücksetzen</a>

{/* Full-page nav — input clears */}
<a href={base}>Zurücksetzen</a>
```

The `restoreFilterValue` client-side approach still applies when a value must *persist* across navigations; use the full-nav form when it should reset.

**Related gotcha — filtering must reset pagination.** A GET filter form should **not** carry a hidden `offset` input set to the current page (`value={String(offset)}`) — that keeps the user on page N when they filter. Omit it (or hard-code `value="0"`) so filtering returns to page 1, while keeping hidden `sort`/`order` if you want the active sort preserved.

**Validated:** 2026-08-31 against `remix 3.0.0-beta.10` + `@remix-run/ui` `reconcile.ts`/`core/props.ts` in `/home/lucky/remix3test`.

Use when server-rendered form inputs with `defaultValue` inside a Frame don't show the expected value after navigation, filter/search inputs are empty after a Frame reload even though the URL has the correct query parameter, or the frame content updates but `<input>` elements keep their old values.

## Verifying Frame-Rendered HTML in Tests

**Context:** Checking that a layout/CSS change to an admin page (e.g. `/admin/workflowagent2`) actually landed, without a browser, by asserting on the server-rendered fragment.

Pages rendered through `renderAdminPage` / `createSidebarLayout` use Remix 3 Frame navigation. A plain full-page GET only returns `<Layout><Frame src=.../></Layout>` — the actual page markup (sidebar shell + content) renders only when the request carries the frame target header `X-Remix-Target: admin-content`. Asserting on the initial GET misses everything you changed. Grepping rendered HTML also has two traps:

1. **Substring false positives:** the Document body uses `min-height: 100vh`, which contains the substring `height: 100vh` — `html.includes('height: 100vh')` passes even when the page still uses it.
2. **CSS serializer spacing:** the `css()` serializer emits a space after colons (`min-height: 3.6rem`, `height: 100%`), so searches must include the space or they come back NOT FOUND.

Fetch the frame-rendered fragment with an authenticated admin session and assert on the returned HTML:

```ts
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

let { cookie } = await createAuthCookieWithCsrfForUser('admin@newapp.com')
let res = await router.fetch(`${BASE}${routes.admin.agentEvents.index.href()}`, {
  headers: { Cookie: cookie, 'X-Remix-Target': 'admin-content' },
})
let html = await res.text()

assert.ok(!html.includes('column;\n  height: 100vh'), 'page must not use height:100vh')
assert.ok(html.includes('min-height: 3.6rem'), 'input min-height present')
assert.ok(html.includes('rows="2"'), 'textarea rows=2')
```

Key facts:

- The frame-target response is a fragment WITHOUT the `<html>`/`<body>` Document shell, so there is no `min-height: 100vh` noise. A standalone page rendered via plain `<Layout>` (not the sidebar shell) returns the full document, so there search for the page-style pattern `column;\n  height: 100vh` instead of the bare `height: 100vh`.
- Use `createAuthCookieWithCsrfForUser(email)` for an authenticated session (avoids the GET → CSRF-token dance).
- Match generated CSS with the space after the colon (`min-height: 3.6rem`, not `min-height:3.6rem`).
- This is a structural check (classes/styles present), not a visual one — scrollbar/layout behavior still needs a browser.
- Run a single file quickly with `npm test -- <glob>`; delete throwaway verification tests afterwards.

Use when verifying a layout/CSS change to an admin (sidebar-shell) page landed without booting a browser, writing a regression assertion that a page no longer contains a specific style, or confirming `fullHeightTargets`/content-only frame targets take effect for a route.
