---
name: remix3-frame-cliententry
description: 'Consolidated patterns for Remix 3 Frame navigation and clientEntry lifecycle management'
user-invocable: false
origin: consolidated
---

# Remix 3 Frame Navigation & clientEntry Patterns

Remix 3's `<Frame>` component and `clientEntry` hydration model form a tightly coupled lifecycle. Frames intercept GET navigations via the browser Navigation API, replacing DOM content server-side without full-page reloads. `clientEntry` components hydrate inside those frames, attaching event listeners and managing interactive state. However, the interaction between these two systems produces several hard-to-debug failure modes: POST submissions bypass Frame interception entirely, `handle.update()` infinite loops fire at page sizes over 50 entries, `mounted` guards silently break after Frame DOM replacement, and binary responses crash the frame router. This document consolidates patterns for working within these constraints — covering form validation errors, cascade limits, mounted-guard fixes, CSS scoping across serialization boundaries, DOM-based inline editing, the `on` mixin's hydration requirement, and `rmx-document` escapes for binary downloads and cross-section links.

## Table of Contents

- [Frame Direct Render — Avoid Double-Load Crash](#frame-direct-render--avoid-double-load-crash)
- [Post Form Submissions in Frames](#post-form-submissions-in-frames)
- [Generic Form Interception for Frames](#generic-form-interception-for-frames)
- [clientEntry Cascade Limit](#cliententry-cascade-limit)
- [mounted Guard After Frame Reload](#mounted-guard-after-frame-reload)
- [Post-Navigation Data Loading in clientEntry](#post-navigation-data-loading-in-cliententry)
- [CSS Child Selectors for clientEntry](#css-child-selectors-for-cliententry)
- [Inline-Edit Server-Rendered Table Cells](#inline-edit-server-rendered-table-cells)
- [on Mixin Requires clientEntry](#on-mixin-requires-cliententry)
- [rmx-document: Binary Downloads & Cross-Section Links](#rmx-document-binary-downloads--cross-section-links)
- [HTML5 Drag and Drop in clientEntry](#html5-drag-and-drop-in-cliententry)
- [Fragment Scrolling Inside Overflow Containers](#fragment-scrolling-inside-overflow-containers)
- [Verifying Frame-Rendered HTML in Tests](#verifying-frame-rendered-html-in-tests)
- [Frame Target Registration & Content-Only Panels](#frame-target-registration--content-only-panels)
- [Frame Input Value Preservation](#frame-input-value-preservation)

---

## Frame Direct Render — Avoid Double-Load Crash

**Context:** A route living inside a Remix 3 `<Frame>` must render differently depending on how it is reached, or it will produce a nested Frame shell that crashes the browser.

### Problem

When a Remix 3 route is backed by a `<Frame>` (via `ShellOrFragment` in a sidebar layout), a full-page GET renders `<Frame src={url} />`. The Frame then fetches the same URL. On the second request, `ShellOrFragment` detects `X-Remix-Target` and returns just the content fragment.

But this double-load (shell → Frame fetch) can crash the browser when the route has heavy rendering, inline scripts, or complex state. The outer shell loads resources, then the Frame loads duplicate resources.

### Solution

Branch in the route's `index` action: detect whether the request is a frame fragment (has `X-Remix-Target`), and if not, render the full page directly without going through `ShellOrFragment`'s Frame wrapper.

```tsx
import { Layout } from '../../ui/layout.tsx'
import { AdminLayout, renderAdminPage } from '../../ui/admin-layout.tsx'
import { frames } from '../../routes.ts'

async index(context) {
  // ... load data ...

  let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
  if (isFrameRequest) {
    // Fragment mode: just the content (sidebar + page) — used by rmx-target navigation
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

### When to Use

- Any Remix 3 route rendered inside a `<Frame>` with `rmx-target` navigation
- When full-page navigation to the route causes a browser crash, slowdown, or resource duplication
- When the route has inline scripts, complex CSS, or heavy rendering

> _Consolidated from: remix3-frame-direct-render_

---

## Post Form Submissions in Frames

# Remix 3: POST Form Submissions Cannot Be Intercepted by Frame Navigation

**Context:** Migrating a render-on-error CRUD form into the admin sidebar Frame. Form validation errors caused 404 GETs because the 400 HTML response created a `<Frame>` that fetched the POST URL.

### Problem

Form validation errors inside a Remix 3 admin sidebar Frame fail with:

```
POST /admin/resource/:id → 400
GET  /admin/resource/:id → 404
```

The root cause chain:

1. `rmx-target` on `<form method="POST">` is **never read** by the Frame Navigation API
2. The browser Navigation API blocks `event.canIntercept` for all non-GET navigations
3. POST form submissions always do a **full-page navigation**, never intercepted
4. `renderAdminPage()` wraps in `ShellOrFragment` which, without `X-Remix-Target`, renders `<Layout><Frame src={request.url}/></Layout>`
5. The `request.url` is the POST URL which has no GET route → 404

### Root Cause

The Frame Navigation API uses the browser's Navigation API (`window.navigation`). The Navigation API's `navigate` event has `event.canIntercept === false` for POST navigations per spec. The `getSourceElementNavigationState` function in `navigation.ts` only reads `rmx-target` from `<a>`/`<area>` elements via `sourceElement.closest('a, area')` — `rmx-target` on `<form>` is never accessed.

### Solution

On POST form error paths, **render the sidebar directly** instead of going through `renderAdminPage()`:

```tsx
// ❌ Broken: Creates Frame → GETs POST URL → 404
return renderAdminPage(
  context.render,
  'resource',
  <Page formValues={rawValues} fieldErrors={fieldErrors} />,
  { status: 400 },
)

// ✅ Works: Renders sidebar directly, no Frame, no GET fallback
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { Layout } from '../../ui/layout.tsx'

return context.render(
  <Layout>
    <AdminLayout activeItem="resource">
      <Page formValues={rawValues} fieldErrors={fieldErrors} />
    </AdminLayout>
  </Layout>,
  { status: 400 },
)
```

The `index` action (GET) continues using `renderAdminPage()` — that's fine because GET navigations ARE intercepted by the Frame.

On success, the POST handler redirects (standard Post/Redirect/Get), the browser follows the redirect as GET, and the Frame bootstraps normally.

### Better Fix: One-Time `ShellOrFragment` Patch

Instead of the per-controller workaround above, patch the shared `ShellOrFragment` in `sidebar-layout.tsx` to wrap non-GET responses in the outer `<Layout>`:

```tsx
// app/ui/sidebar-layout.tsx
function ShellOrFragment(handle: Handle<PageProps>) {
  return () => {
    let { activeItem, children } = handle.props
    if (isFrameRequest()) {
      return <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
    }
    // POST/PUT/DELETE validation errors: render full page (outer Layout + admin shell)
    // not just LayoutComponent — otherwise the browser gets no <html>/<head>/<body>/MainNav
    if (getContext().request.method !== 'GET') {
      return (
        <Layout>
          <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
        </Layout>
      )
    }
    return (
      <Layout>
        <Frame name={frameTarget} src={getContext().request.url} />
      </Layout>
    )
  }
}
```

This way **every controller** can use `renderAdminPage()` uniformly — even on POST validation error paths — and the shared component handles the wrapping correctly:

```tsx
// ✅ All controllers — works on GET, POST, PUT, DELETE
return renderAdminPage(
  context.render,
  'resource',
  <Page formValues={rawValues} fieldErrors={fieldErrors} />,
  { status: 400 },
)
```

**Why this is better:**

- One fix applies to all admin routes — no per-controller `Layout + AdminLayout` duplication
- Controllers stay consistent (always `renderAdminPage`)
- The outer `<Layout>` provides `<Document>` (html/head/body), `<MainNav>` (top nav), `<main>`, and `<footer>` — without it, browsers receive a bare `<div>` fragment with no page structure, causing a "layout crash"

### When to Use

- Adding render-on-error form validation to a CRUD page inside an admin sidebar Frame
- Any `<form method="POST">` with `rmx-target` that unexpectedly does a full-page navigation
- Debugging "GET → 404" after a POST form submission inside a Frame
- Understanding why `rmx-target` on `<form>` elements is ignored

(Consolidated from `remix3-frame-post-uninterceptable`)

---

## Generic Form Interception for Frames

# Remix 3: Intercept All Frame Form Submissions via Event Delegation

**Context:** A route-agent page uses a `<Frame>` to show target routes. Any `<form method="POST">` inside the frame causes a full-page navigation, destroying the parent page (agent input bar, message history). Affects all server-rendered forms inside any Frame.

### Problem

Remix 3's `<Frame>` does **not** intercept HTML form submissions:

1. `<Frame>` is a DOM region (comment markers + DOM diffing), not an `<iframe>` — form submissions are normal browser navigations
2. The Navigation API (`window.navigation`) sets `event.canIntercept === false` for all non-GET navigations per spec — POST/PUT/DELETE form submissions are never captured
3. `rmx-target` attribute is only read from `<a>`/`<area>` elements (`navigation.ts`), never from `<form>` elements

Result: any `<form method="POST">` inside a Frame navigates the **main window** to the action URL. For the route-agent page, this replaces the entire agent interface with the target page.

### Solution

Add a single `submit` event listener on the frame container element using **event delegation**. This catches all forms inside the frame with one listener:

```typescript
// In the route-agent's clientEntry (RouteAgentStream):
let container = document.getElementById('route-agent-frame-container')
if (container) {
  container.addEventListener('submit', async (e) => {
    let form = (e.target as HTMLElement).closest('form')
    if (!form || form.id === 'route-agent-form') return // skip agent's own form
    e.preventDefault()

    // Submit the form server-side via fetch
    await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
    })

    // Reload the frame to show updated content
    let frame = handle.frames.get('lists-content')
    if (frame) {
      await frame.reload()
    }
  })
}
```

The server still renders and processes everything. The only client-side change is swapping "browser navigates away" for `fetch` + `frame.reload()`.

#### GET form handling

The code above only handles POST/PUT/DELETE. **GET forms** (search/filter forms with `method="GET"`) also navigate the full page when inside a Frame. The `rmx-target` attribute is never read from `<form>` elements, regardless of method.

For GET forms, use `URLSearchParams` to serialize the form data and set the frame's `src` directly:

```typescript
container.addEventListener('submit', async (e) => {
  let form = (e.target as HTMLElement).closest('form')
  if (!form || form.id === 'my-agent-form') return
  e.preventDefault()

  let method = (form.method || 'GET').toUpperCase()
  let action = form.getAttribute('action') || ''
  let target = form.getAttribute('rmx-target')

  let frame = target ? handle.frames.get(target) : handle.frame
  if (!frame) return

  if (method === 'GET') {
    let params = new URLSearchParams(new FormData(form) as any)
    let qs = params.toString()
    frame.src = action + (qs ? '?' + qs : '')
    frame.reload().catch(() => {})
  } else {
    await fetch(action, { method, body: new FormData(form) })
    await frame.reload()
  }
})
```

This works for both GET (filter/search) and non-GET forms with the same event delegation pattern.

#### Why `handle.frame.reload()` not `handle.frame.replace()`

- `reload()` re-fetches the frame's current `src` via the Frame's `resolveFrame` pipeline, which sets `X-Remix-Target`, `X-Remix-Frame`, and Cookie headers correctly
- `replace()` takes raw HTML and diffs it into the frame DOM — but the Fetch POST response is the full page-wrapped HTML (with `<Layout>`, `<html>`, etc.), which breaks when parsed as a fragment inside a child frame
- Using `reload()` avoids needing to reconstruct the correct response format

#### Why per-form `clientEntry` is not ideal

A per-form clientEntry (one per form inside the frame) duplicates interception logic and requires each form to have an `id` or specific selector. Event delegation on the container is a single, generic handler.

### When to Use

- Any Remix 3 app where a parent page uses `<Frame>` to show content with server-rendered forms
- The route-agent page (or similar "agent/command bar" pattern) where forms inside the frame must not destroy the parent interface
- Debugging "why does this form navigate away from my parent page?" inside a Frame
- Before adding per-form `clientEntry` handlers — check if event delegation suffices

---

## clientEntry Cascade Limit

# Remix 3 Frame clientEntry Cascade Limit

**Context:** A Remix 3 Frame that hosts 50+ `clientEntry` components (e.g., per-row delete buttons in a grid table) crashes on pagination with `handle.update() infinite loop detected`.

### Problem

A Remix 3 Frame's grid crashes with `Error: handle.update() infinite loop detected` when the page size is large enough to produce 50+ rows, but only on **subsequent page loads** (pagination, sort, filter), not on the initial load.

**Root cause chain:**

1. All `clientEntry` hydrations within a single Frame share that Frame's scheduler (`scheduler.ts`)
2. The scheduler's `cascadingUpdateCount` increments on every `flush()` call
3. On the **first load**, modules aren't cached yet — hydrations happen asynchronously in separate microtasks, giving `setTimeout(0)` a chance to reset the counter
4. On **subsequent loads** (pagination), modules are already in `context.moduleCache`, so all hydrations run **synchronously** without yielding to the event loop, accumulating the counter past `MAX_CASCADING_UPDATES = 50`
5. The error fires at counter value 51 (`> 50`), even though no actual infinite loop exists

### Solution

Reduce the number of `clientEntry` components within the Frame to stay below the 50 threshold:

1. **Replace per-row clientEntry with server-rendered forms** — use standard `<form method="POST" rmx-target="<frame-name>" data-confirm="...">` instead of per-row `clientEntry` delete buttons
2. **Use event delegation** — a single `clientEntry` can handle all row actions via DOM event delegation (e.g., `target.closest('tr[data-row-id]')`)
3. **Embed row data as JSON** in a `<script id="...-table-data" type="application/json">` tag for the delegated handler to read

Server-rendered forms inside a Frame need:

- `<CsrfTokenInput />` for the CSRF token
- `<input type="hidden" name="_method" value="DELETE" />` for method override (DELETE from POST form)
- Hidden inputs for offset/sort/order/filter state
- `rmx-target="<frame-name>"` for Frame-aware form submission without full page navigation
- Redirect the destroy action to the grid fragment URL (e.g., `/client/grid`) not the full page URL (`/client`)

### When to Use

- A Remix 3 Frame crashes with `handle.update() infinite loop detected` during pagination
- You have many `clientEntry` components (50+) inside a single Frame
- You're building a data grid with per-row action buttons inside a Frame
- You encounter the error only on cached (second+) renders, not on the first page load

(Consolidated from `remix3-frame-cliententry-cascade-limit`)

---

## mounted Guard After Frame Reload

# `let mounted = false` in clientEntry Breaks After Frame Reload

**Context:** All admin context menus stopped working after sort/paginate/filter in a Remix 3 Frame-based admin panel. The root cause was a `let mounted = false` guard in each `clientEntry` closure that prevented re-attaching event listeners after Frame DOM replacement.

### Problem

A `clientEntry` uses `let mounted = false` to prevent duplicate event listener registration:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    let mounted = false

    return () => {
      let el = document.getElementById('my-element')
      if (!mounted && el) {
        mounted = true
        el.addEventListener('click', handler, { signal: handle.signal })
      }
      return <div />
    }
  },
)
```

After Frame-targeted navigation (sort, paginate, filter), the interactive behavior silently stops working because:

1. The Frame's DOM content is replaced with new HTML from the server
2. The `clientEntry` factory closure is **preserved** across Frame updates — only the render function re-runs
3. `mounted` is still `true` from the initial hydration, so the listener attachment is skipped
4. The new DOM nodes have no event listeners → component silently broken

### Solution

Replace the `mounted` guard with one of three patterns depending on the component architecture:

#### Pattern A: `ref()` with per-insertion AbortSignal

For components that render a DOM element (e.g., a hidden trigger div) inside the `clientEntry`'s JSX return value. The `ref()` mixin fires on every DOM insertion and provides an `AbortSignal` for cleanup:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    return () => (
      <div
        mix={ref((el, signal) => {
          let table = document.getElementById('my-table')
          if (!table) return

          function onContextMenu(event: Event) {
            // ... handler logic ...
          }

          table.addEventListener('contextmenu', onContextMenu, { capture: true })
          signal.addEventListener('abort', () => {
            table.removeEventListener('contextmenu', onContextMenu)
          })
        })}
      />
    )
  },
)
```

`ref()` fires on every DOM insertion (initial hydration AND Frame replacement). The ref's `signal` fires when the element is removed (Frame navigation cleans up old listeners eagerly).

#### Pattern B: Table-identity tracking with AbortController

For components that query a **server-rendered** DOM element (not rendered by the clientEntry's return value). Track the DOM node identity and use a per-attachment `AbortController`:

```typescript
export const MyInteractive = clientEntry(
  import.meta.url + '#MyInteractive',
  function MyInteractive(handle: Handle) {
    let currentTable: HTMLElement | null = null
    let attachController: AbortController | null = null

    handle.signal.addEventListener('abort', () => {
      attachController?.abort()
    })

    return () => {
      let table = typeof document !== 'undefined'
        ? document.getElementById('my-table')
        : null
      if (table && table !== currentTable) {
        attachController?.abort()
        attachController = new AbortController()
        currentTable = table

        table.addEventListener('click', onClick, { signal: attachController.signal })
      }

      return <div />
    }
  },
)
```

On each render, compare the current DOM node against the cached reference. If different (Frame replaced the DOM), abort the old controller (removes old listeners) and attach fresh ones.

#### Pattern C: Remove `mounted` guard from existing `ref()` callbacks

For `ref()` callbacks that already exist but are guarded by `mounted`. The `ref()` only fires on actual DOM insertion (not on `handle.update()`), so removing the guard is safe:

```typescript
// Before (broken):
let mounted = false
ref((el) => {
  triggerRef = el
  if (mounted) return
  mounted = true
  table.addEventListener('contextmenu', onContextMenu)
  handle.signal.addEventListener('abort', () => {
    table.removeEventListener('contextmenu', onContextMenu)
  })
})

// After (fixed):
ref((el) => {
  triggerRef = el
  table.addEventListener('contextmenu', onContextMenu)
  handle.signal.addEventListener('abort', () => {
    table.removeEventListener('contextmenu', onContextMenu)
  })
})
```

The `mounted` guard is unnecessary for `ref()` callbacks because:

- `ref()` fires only on DOM insertion (not on `handle.update()`)
- On Frame navigation, the old element is removed and a new one is inserted → `ref()` fires again
- `handle.signal` cleanup ensures no listener leaks when the component is disposed

### When to Use

- A `clientEntry` component with event listeners or DOM interactions silently stops working after Frame-targeted navigation (sort, paginate, filter)
- You see `let mounted = false` (or `let initialized = false`) guarding `addEventListener` or `document.getElementById` in a clientEntry
- Admin grid context menus, inline edit controls, or any interactive elements inside a Remix 3 `<Frame>`

(Consolidated from `remix3-cliententry-mounted-guard-frame-reload`)

---

## Post-Navigation Data Loading in clientEntry

# Remix 3: Reloading Data After Frame Navigation in clientEntry

**Context:** A `clientEntry` editor needs to load a different resource when the user clicks a sidebar link targeting the frame — the URL changes but the `clientEntry` closure is preserved.

### Problem

A `clientEntry` reads its initial data from `location.search` (or a DOM attribute) on first hydration. When the enclosing `<Frame>` navigates to a different URL, the `clientEntry` needs to detect the URL change and reload data. However:

1. The **render function IS re-called** after frame navigation (the factory closure persists, only the render function re-runs)
2. But calling `handle.update()` inside the render function to trigger a re-render has **timing issues** — the DOM may not be fully updated yet, and setting state during render can interact badly with the scheduler
3. Reading `location.search` in the render function is unreliable because address bar updates might not be synchronized with the frame's actual URL

This produces symptoms like: "click loads the list the first time, but subsequent clicks on different sidebar entries don't load anything" or "the form is blocking reloading after the first navigation".

### Solution

Use `handle.frame.addEventListener('reloadComplete', ...)` to detect when the frame finished navigating, and read `handle.frame.src` (not `location.search`) as the source of truth for the frame's current URL:

```typescript
export const MyEditor = clientEntry(
  import.meta.url + '#MyEditor',
  function MyEditor(handle: Handle) {
    let loadedItemId: number | null = null
    let expectedItemId: string | null = null
    let loading = false
    let loadError = ''

    function loadFromServer(id: string) {
      loading = true
      handle.update()
      fetch(`/api/data/${id}`)
        .then((r) => r.json())
        .then((data) => { /* update state */ })
        .catch(() => { loadError = 'Failed to load' })
        .finally(() => { loading = false; handle.update() })
    }

    function reloadFromFrame() {
      if (handle.signal.aborted) return
      let url = new URL(handle.frame.src, location.origin)
      let id = url.searchParams.get('id')
      if (id === expectedItemId) return  // dedup — same item
      expectedItemId = id
      loadError = ''  // clear stale error on navigation
      if (id) {
        loadFromServer(id)
      } else {
        loadedItemId = null
        handle.update()
      }
    }

    // Listen for frame navigation
    handle.frame.addEventListener(
      'reloadComplete',
      reloadFromFrame,
      { signal: handle.signal },
    )

    return () => {
      // Initial mount: read from frame.src
      if (typeof document !== 'undefined' && !expectedItemId) {
        let url = new URL(handle.frame.src, location.origin)
        let id = url.searchParams.get('id')
        if (id) {
          expectedItemId = id
          loadFromServer(id)
        }
      }

      if (loading) return <div>Loading…</div>
      if (loadError) return <div>{loadError}</div>
      return <div>{/* render editor with data */}</div>
    }
  },
)
```

The `reloadComplete` event fires in the `finally` block after the frame's new content is rendered (`~/remix/packages/ui/src/runtime/frame.ts:215`). At this point `handle.frame.src` contains the just-rendered URL. This is more reliable than reading `location.search` (which may not match the frame's actual URL after frame-only navigation).

### Frame-Only Navigation (replace `window.location.href`)

When you need to programmatically navigate the frame (e.g., after saving data), use the `handle.frame.src` + `handle.frame.reload()` pattern instead of `window.location.href`:

```typescript
function navigateFrame(href: string) {
  handle.frame.src = href
  handle.frame.reload().catch(() => {}) // returns Promise — suppress unhandled rejection
}
```

This triggers a frame-only navigation (no full page reload), the `reloadComplete` listener fires, and the editor loads the new data. The parent page and other frames are unaffected.

The `.catch(() => {})` is required because `handle.frame.reload()` returns a `Promise<AbortSignal>` and may reject on network errors.

### Avoiding Race Conditions (AbortController)

If the user clicks sidebar entries rapidly, multiple `reloadComplete` events can fire while previous fetches are still in flight. Cancel the previous fetch using `AbortController`:

```typescript
let loadController: AbortController | null = null

function reloadFromFrame() {
  if (handle.signal.aborted) return
  let url = new URL(handle.frame.src, location.origin)
  let id = url.searchParams.get('id')
  if (id === expectedItemId) return
  expectedItemId = id
  loadController?.abort() // cancel previous in-flight fetch
  loadController = new AbortController()
  if (id) {
    loadFromServer(id, loadController.signal)
  }
}

async function loadFromServer(id: string, signal?: AbortSignal) {
  try {
    let response = await fetch(`/api/data/${id}`, signal ? { signal } : undefined)
    if (signal?.aborted) return
    // ... process data ...
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    loadError = 'Failed to load'
  }
  if (signal?.aborted) return
  loading = false
  handle.update()
}
```

### When to Use

- A `clientEntry` inside a `<Frame>` needs to reload data when the frame navigates to a different URL
- The editor works on first page load but stops responding to sidebar/frame navigation clicks
- You see the pattern `let initialized = false` guarding data reads from `location.search` or DOM attributes
- You need to programmatically navigate a frame from within a `clientEntry` without a full page reload
- Rapid sidebar clicks cause stale data to briefly appear (use the AbortController variant)

**Related:** See the [mounted Guard After Frame Reload](#mounted-guard-after-frame-reload) section above for re-attaching event listeners after frame navigation (complementary — use both patterns when the component has listeners AND needs to reload data).

(Consolidated from `remix3-post-navigation-data-loading`)

---

## CSS Child Selectors for clientEntry

# Remix 3: ClientEntry CSS Child Selectors for Nested Buttons

**Context:** Creating a joined "Edit | Del" button group where the parent needs to style child Button components inside a `clientEntry` component.

### Problem

`clientEntry` components extend `SerializableProps` — only JSON-serializable values can be passed as props. CSS `MixinDescriptor` objects (produced by `css()`) are **not** serializable, so you cannot pass `btnMix` or similar styling props to a `clientEntry` component.

This blocks the common pattern of creating a joined "Edit | Del" button group where the parent needs to style child Button components.

### Solution

Use **parent-container CSS with child selectors** instead of passing mixins as props:

```tsx
const actionBtnGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  '& > a > button': {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRight: 'none',
  },
  '& > form > button': {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
})

// Usage — no mix props needed on DelButton
<div mix={actionBtnGroup}>
  <a href={editUrl}>
    <Button tone="secondary" mix={smallBtnStyle}>Edit</Button>
  </a>
  <DelButton action={delUrl} offset={...} sort={...} order={...} filterValue={...} />
</div>
```

The CSS targets the known DOM structure:

- Edit button is inside `<a><button/></a>` → `& > a > button`
- Del button is inside `<form><button/></a>` (from DelButton) → `& > form > button`

### Why

`remix/ui` CSS-in-JS uses scoped selectors. The `&` in `css()` resolves to the generated scoped class. Combined with child combinators (`>`), you can precisely target nested elements without needing to pass CSS objects through serializable prop boundaries.

### When to Use

- Creating joined button groups where one button is a `clientEntry` component
- Styling children of a container that wraps `clientEntry` components
- Any pattern where you'd normally pass a CSS mixin as a prop but the child is a `clientEntry`

(Consolidated from `remix3-cliententry-css-child-selectors`)

---

## Inline-Edit Server-Rendered Table Cells

# Remix 3: Inline-Edit Server-Rendered Table Cells via DOM Manipulation

**Context:** Adding an editable email column to a server-rendered admin table using one `clientEntry` component (not per-row).

### Problem

You have a server-rendered `<table>` in Remix 3 and want inline editing: click a cell → it becomes an `<input>` → save via fetch → grid refreshes.

A naive approach creates one `clientEntry` per row (`N` hydrations, `N` closured states). This causes `handle.update()` issues because each clientEntry re-renders independently, and the server-owned table DOM is hard to coordinate.

### Solution

Use a **single** `clientEntry` per page. Since the table is owned by the server component, the clientEntry cannot re-render individual cells via its render function. Instead, use **DOM manipulation** to replace cell content with an `<input>`.

#### Architecture

```
Single clientEntry
  ├── Click delegation on <table> (not per-cell listeners)
  ├── DOM: replace <td>.textContent with <input>
  ├── fetch PUT /resource/:id with JSON + CSRF
  ├── On success: handle.frame.reload()
  └── On error: append <div> error to the cell
```

#### Implementation Pattern

```tsx
import { clientEntry, css, type Handle } from 'remix/ui'

export const InlineEdit = clientEntry(
  import.meta.url + '#InlineEdit',
  function InlineEdit(handle: Handle) {
    let activeInput: HTMLInputElement | null = null
    let activeCell: HTMLTableCellElement | null = null
    let activeRowId: number | null = null
    let originalValue = ''
    let saving = false

    handle.signal.addEventListener('abort', () => {
      cleanup()
    })

    function cleanup() {
      activeInput = null
      activeCell = null
      activeRowId = null
      originalValue = ''
      saving = false
    }

    // ⚠️ MUST use named function — not anonymous arrow
    // The same reference is used for both addEventListener and removeEventListener
    function onCellClick(e: Event) {
      if (saving) return
      let cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-inline-edit]')
      if (!cell) return
      if (activeCell) {
        commitEdit()
        return
      } // save current, don't open new
      startEdit(cell)
    }

    return () => {
      if (typeof document !== 'undefined') {
        let table = document.querySelector<HTMLElement>('#my-table')
        if (!table) return <div mix={css({ display: 'none' })} />

        table.addEventListener('click', onCellClick)

        handle.signal.addEventListener('abort', () => {
          table.removeEventListener('click', onCellClick) // same ref
        })
      }
      return <div mix={css({ display: 'none' })} />
    }

    function startEdit(cell: HTMLTableCellElement) {
      if (saving) return
      let row = cell.closest<HTMLTableRowElement>('[data-row-id]')
      if (!row) return

      activeRowId = Number(row.getAttribute('data-row-id'))
      originalValue = cell.textContent?.trim() ?? ''
      activeCell = cell

      let input = document.createElement('input')
      input.type = 'email'
      input.value = originalValue
      input.addEventListener('keydown', onInputKeydown)
      input.addEventListener('blur', onInputBlur)

      cell.textContent = ''
      cell.appendChild(input)
      activeInput = input
      input.focus()
      input.select()
    }

    function onInputKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    }

    function onInputBlur() {
      if (!saving) commitEdit()
    }

    function commitEdit() {
      if (!activeInput || !activeCell || !activeRowId) return
      let newValue = activeInput.value.trim()
      if (!newValue || newValue === originalValue) {
        revertCell()
        return
      }

      saving = true
      let csrfToken = readCsrfToken()
      let rowId = activeRowId

      fetch(`/resource/${rowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({ email: newValue }),
      })
        .then(async (res) => {
          if (res.ok) {
            cleanup()
            handle.frame.reload().catch(() => {}) // ⚠️ frame.reload() returns a Promise
          } else {
            let data = await res.json().catch(() => ({ error: 'Save failed' }))
            saving = false
            showError(data.error || 'Save failed')
          }
        })
        .catch(() => {
          saving = false
          showError('Network error')
        })
    }

    function cancelEdit() {
      revertCell()
    }

    function revertCell() {
      if (activeCell && activeInput) {
        activeCell.textContent = originalValue
      }
      cleanup()
    }

    function showError(msg: string) {
      if (!activeCell || !activeInput) return
      let err = document.createElement('div')
      err.textContent = msg
      err.style.cssText = 'color:red;font-size:0.7rem;margin-top:2px;'
      activeCell.appendChild(err)
      activeInput.focus()
    }
  },
)
```

#### Server-Side Wiring

The server-rendered table needs:

1. **`data-inline-edit`** on editable cells
2. **`data-row-id`** on each `<tr>`
3. **CSRF token** embedded (e.g., `<script id="grid-state" ...>` or `<meta name="csrf-token">`)
4. **`tabindex={0}`, `role="button"`, `aria-label`** on editable cells for keyboard access
5. **Controller** must accept `Content-Type: application/json` bodies for partial updates

```tsx
// Grid page (server component)
<td data-inline-edit="email" tabindex={0} role="button" aria-label={`Edit email: ${row.email}`}>
  {row.email}
</td>
```

```typescript
// Controller
if (contentType.includes('application/json')) {
  let body = await request.json()
  // validate + update + return JSON
  return context.json({ ok: true })
}
// else: existing form-data path unchanged
```

#### Pitfalls

| Pitfall                              | Symptom                                          | Fix                                          |
| ------------------------------------ | ------------------------------------------------ | -------------------------------------------- |
| Anonymous arrow in addEventListener  | removeEventListener silently fails → memory leak | Store handler in named variable              |
| Not guarding `saving` flag           | Race condition: two saves fire simultaneously    | `if (saving) return` at top of click handler |
| Not catching `handle.frame.reload()` | Unhandled promise rejection on network error     | `.catch(() => {})`                           |
| InnerHTML instead of textContent     | XSS vulnerability if cell contains user data     | Always use `.textContent`                    |

### When to Use

- Adding inline editing to an existing server-rendered table
- Admin CRUD interfaces where one `clientEntry` should manage all rows
- Any pattern where a `clientEntry` needs to edit DOM it doesn't own (server-rendered)

(Consolidated from `remix3-inline-edit-dom-cliententry`)

---

## on Mixin Requires clientEntry

# Remix 3: `on` Mixin Silently Fails in Server-Rendered Components

**Context:** Adding a "Vergangene löschen" button with a `confirm()` dialog to an admin offerings page in a Remix 3 project.

### Problem

Using the `on` event mixin from `remix/ui` in a server-rendered component (not wrapped in `clientEntry`) compiles without errors but the event handler **never fires** on the client. Raw HTML event attributes (`onsubmit`, `onclick`) as string props also fail with TypeScript errors. The `on` mixin's handler code only gets hydrated when the component is a `clientEntry` — otherwise the mixin output is static HTML with no client-side JS.

### Solution

Wrap the interactive element in a `clientEntry` component. Props must extend `SerializableProps` (strings, numbers, booleans, null — no functions), and the entry ID is `import.meta.url + '#ComponentName'`. The `on` handler goes in setup scope (inside the `return () => {` closure) so it has stable references. For form submission, create the form programmatically in the handler, or use `fetch()` + `handle.frame.reload()` (see `admin-action-button.tsx`).

#### Where to Mount Global clientEntry Behaviors

A `clientEntry` that registers global event listeners (e.g., theme toggle, analytics, keyboard shortcuts) must mount in the **root `<Document>` wrapper**, not `<Layout>`. Pages rendered directly through `<Document>` (standalone landing pages) never mount `<Layout>`, so the `clientEntry` never hydrates and the feature silently breaks.

Mount global `clientEntry` components in `<body>` inside `Document`:

```tsx
// app/ui/document.tsx — shared by ALL pages
export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html>
      <head>...</head>
      <body>
        {children}
        <ThemeToggle /> {/* ← mounted on every page */}
      </body>
    </html>
  )
}
```

Remove duplicate mounts from `<Layout>` — `<Document>` is the single root wrapper for all routes, and `clientEntry` components use an `initialized` flag to prevent duplicate hydration.

### When to Use

- When `on` mixin compiles but the handler doesn't fire — immediately suspect missing `clientEntry`
- Adding `confirm()` dialogs to admin action buttons
- Mounting a global behavior `clientEntry` so it hydrates on every page (Document, not Layout)

(Consolidated from `remix-on-mixin-requires-cliententry`)

---

## rmx-document: Binary Downloads & Cross-Section Links

**Context:** Links inside Frame contexts to binary download endpoints or to a different Frame-relay section crash or freeze the browser when the frame router intercepts them.

### Problem

Remix's frame router intercepts `<a>` clicks, fetches the URL with `Accept: text/html` + `X-Remix-Frame: true`, and parses the response as a component tree. Two failure modes:

1. **Binary download → DOM crash**: Clicking a link to a PDF/CSV/ZIP endpoint makes the router try to mount the binary response as HTML, producing `Node.insertBefore: Cannot insert a Text as a child of a Document`. The same URL works on reload because full-page navigation skips the frame router.
2. **Cross-section link → 100% CPU loop**: A plain `<a>` navigating to a different Frame-relay section triggers a frame-resolution loop (destination returns another `<Frame>`, which resolves to another...). Symptoms: server returns 200 for all requests, the tab pegs at 100% CPU and freezes, clientEntry data fetches never fire.

### Solution

The `rmx-document` attribute tells the Remix navigation runtime to skip frame interception for that link (`navigation.ts: if (linkElement.hasAttribute('rmx-document')) return`), forcing a normal document-level navigation:

```tsx
<a href={routes.export.pdf.index.href()} rmx-document>PDF herunterladen</a>

<a href={`/lists?load=${row.id}`} target="_top" rmx-document>{row.description}</a>
```

#### Guard the controller against frame requests

If the URL is reached directly while inside a frame, the request still carries `X-Remix-Frame: true`. Redirect to force a full-page navigation:

```tsx
async index(context) {
  if (context.request.headers.get('X-Remix-Frame') === 'true') {
    let url = new URL(context.url)
    return new Response(null, {
      status: 302,
      headers: { Location: url.href },
    })
  }
  // ... generate and return binary response ...
}
```

#### Conditionally apply `rmx-document` in shared navigation

For components rendered across sections (e.g., MainNav), apply `rmx-document` only when the destination section differs from the current section. This preserves fast frame-based navigation within the same section:

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
<a href={item.href} {...(item.href && isCrossSection(item.href) ? { 'rmx-document': '' } : {})}>
  {item.label}
</a>
```

### When to Use

- Adding any route that returns binary content (`application/pdf`, `text/csv`, `application/zip`) in an app that uses `<Frame>` navigation
- Debugging `Node.insertBefore` DOM errors after clicking a link from a frame context
- Adding a plain `<a>` inside Frame-rendered content that navigates to another section
- Debugging 100% CPU / browser freeze after clicking a link from a Frame-relay page
- Building shared navigation components that render across Frame-relay sections

> _Consolidated from: remix-frame-binary-download_

---

## HTML5 Drag and Drop in clientEntry

**Context:** Implementing drag-and-drop reordering of list items in a `clientEntry` component

### Problem

Adding HTML5 Drag and Drop (`dragstart`, `dragover`, `drop`, `dragend`) to a Remix 3 `clientEntry` hits three issues:

1. **`on()` mixin rejects drag events** — `on('dragstart', handler)` fails TypeScript because `EventType<Element>` (the target type for JSX elements) does not include HTML5 drag events. Only `HTMLElementEventMap` includes them, but the template system targets `Element`.
2. **`handle.update()` during drag causes infinite loop** — calling `handle.update()` inside `dragover` (which fires on every mouse pixel) triggers a re-render, which the Remix scheduler detects as cascading updates and throws `Error: handle.update() infinite loop detected`.
3. **Stale closures after key-based reorder** — after a successful drop, `handle.update()` re-renders the list. Key-based reconciliation reuses DOM elements, so `ref()` callbacks **don't re-fire**. Event listener closures keep the **old** `index` value, corrupting subsequent drag operations.

### Solution

#### 1. Use `ref()` + `addEventListener` instead of `on()`

Attach drag event listeners via `ref()` with an `AbortController` for cleanup:

```ts
import { clientEntry, ref, css } from 'remix/ui'

export const MyList = clientEntry(import.meta.url + '#MyList', (handle) => {
  let items = [...]

  let handleDragStart = (e: DragEvent, index: number) => { ... }
  let handleDragOver = (e: DragEvent, index: number) => { ... }
  let handleDrop = () => { ... }
  let handleDragEnd = () => { ... }

  return () => (
    <div>
      {items.map((item, index) => (
        <div
          key={item.id}
          mix={ref((el) => {
            let ac = new AbortController()
            el.addEventListener('dragstart', (e) => {
              let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
              handleDragStart(e as DragEvent, idx)
            }, { signal: ac.signal })
            el.addEventListener('dragover', (e) => {
              let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
              handleDragOver(e as DragEvent, idx)
            }, { signal: ac.signal })
            el.addEventListener('drop', (e) => handleDrop(e as DragEvent), { signal: ac.signal })
            el.addEventListener('dragend', () => handleDragEnd(), { signal: ac.signal })
            return () => ac.abort()
          })}
          draggable="true"
          data-index={index}
        >
          ...
        </div>
      ))}
    </div>
  )
})
```

#### 2. Never call `handle.update()` during active drag

Visual feedback must use **direct DOM manipulation**:

```ts
let draggedEl: HTMLElement | null = null
let indicatorEl: HTMLElement | null = null

let handleDragStart = (e: DragEvent, index: number) => {
  let el = e.currentTarget as HTMLElement
  draggedEl = el
  el.style.opacity = '0.4'
}

let handleDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  e.stopPropagation()
  if (targetEl) targetEl.style.borderTop = '2px solid blue'
}

let handleDrop = () => {
  if (indicatorEl) indicatorEl.style.borderTop = ''
  items = reorderedItems
  handle.update()
}

let handleDragEnd = () => {
  let dirty = draggedEl !== null || indicatorEl !== null
  if (draggedEl) draggedEl.style.opacity = ''
  if (indicatorEl) indicatorEl.style.borderTop = ''
  if (dirty) handle.update()
}
```

#### 3. Read `data-index` live from the DOM, not from closure

```ts
// ✅ Correct: read live from DOM
el.addEventListener(
  'dragover',
  (e) => {
    let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
    handleDragOver(e as DragEvent, idx)
  },
  { signal: ac.signal },
)

// ❌ Wrong: captured in closure, stale after reorder
el.addEventListener('dragover', (e) => handleDragOver(e as DragEvent, index), { signal: ac.signal })
```

For container-level iteration, use `listRef.children[i]` (scoped, O(1)):

```ts
let listRef: HTMLDivElement | null = null

let elByIndex = (i: number): HTMLElement | null => {
  let child = listRef?.children[i]
  return child instanceof HTMLElement ? child : null
}
```

#### 4. Set `draggable="false"` on interactive children

```tsx
<div draggable="false" mix={css({ display: 'flex', gap: '8px' })}>
  <button>Edit</button>
  <button>Delete</button>
</div>
```

### When to Use

- Implementing drag-and-drop reordering in a Remix 3 `clientEntry`
- Getting TypeScript errors when using `on('dragstart', ...)` or `on('dragover', ...)`
- Getting `handle.update() infinite loop detected` during drag operations
- Drag operations work once but break after reordering items

(Consolidated from `remix3-cliententry-drag-and-drop`)

---

## Fragment Scrolling Inside Overflow Containers

**Context:** A Remix 3 chat page needed to scroll the message container to the bottom after POST+redirect, but inline `<script>` tags don't execute in frame navigation because content is fetched via `router.fetch()` and injected into the DOM.

### Problem

Remix 3 frame navigation fetches HTML via `router.fetch()` and injects it into the DOM. Inline `<script>` tags in frame responses **do not execute**. This blocks client-side scroll-to-bottom patterns like:

```html
<script>
  document.getElementById('chat-messages').scrollTop = ...
</script>
```

Using `clientEntry` from `remix/ui` works but adds complexity — a separate file, async hydration, and lifecycle management with `requestAnimationFrame`.

### Solution

Place a `<div id="your-target" />` **inside** the scrollable overflow container (`overflow-y: auto`), then navigate to the URL with `#your-target` hash.

The browser's native fragment scrolling doesn't just scroll `<html>` — it finds the **nearest scrollable ancestor** of the target element and scrolls THAT container to make the target visible.

### Example

```tsx
// ❌ Broken in frame navigation: inline script never fires
<div id="chat-messages" mix={conversationStyle}>
  {messages.map(msg => <div>{msg}</div>)}
</div>
<div id="chat-end" />
<script>document.getElementById('chat-messages').scrollTop = ...</script>

// ✅ Works: fragment scrolls the overflow container natively
<div id="chat-messages" mix={conversationStyle}>
  {messages.map(msg => <div>{msg}</div>)}
  <div id="chat-end" />  {/* ← inside the scrollable container */}
</div>
```

Then include the hash in navigation URLs:

```ts
// On success POST redirect
let url = routes.chat.index.href() + '?threadId=' + id + '#chat-end'
return redirect(url)

// On links to existing conversations
let link = routes.chat.index.href() + '?threadId=' + id + '#chat-end'
```

### How It Works

1. Browser parses the URL hash (`#chat-end`)
2. Finds the element with matching `id`
3. Walks up the DOM tree to find the first ancestor with `overflow: auto` or `overflow: scroll`
4. Scrolls that ancestor to make the target element visible (at the bottom if it's the last child)

### Required CSS on the container

```css
overflow-y: auto; /* makes the div a scroll container */
/* or */
overflow-y: scroll; /* always shows scrollbar */
```

### When to Use

- A Remix 3 chat/message page needs scroll-to-bottom after form submission
- Inline `<script>` tags don't work (frame navigation, content injection)
- You want scroll-to-bottom without a `clientEntry` component
- Fragment scrolling already works for page-level anchors but fails for elements inside scrollable divs

(Consolidated from `remix3-fragment-scroll-overflow-container`)

---

## Verifying Frame-Rendered HTML in Tests

**Context:** Checking that a layout/CSS change to an admin page (e.g. `/admin/workflowagent2`) actually landed, without a browser, by asserting on the server-rendered fragment.

### Problem

Pages rendered through `renderAdminPage` / `createSidebarLayout` use Remix 3 Frame navigation. A plain full-page GET only returns `<Layout><Frame src=.../></Layout>` — the actual page markup (sidebar shell + content) renders only when the request carries the frame target header `X-Remix-Target: admin-content`. Asserting on the initial GET misses everything you changed. Grepping rendered HTML also has two traps:

1. **Substring false positives:** the Document body uses `min-height: 100vh`, which contains the substring `height: 100vh` — `html.includes('height: 100vh')` passes even when the page still uses it.
2. **CSS serializer spacing:** the `css()` serializer emits a space after colons (`min-height: 3.6rem`, `height: 100%`), so searches must include the space or they come back NOT FOUND.

### Solution

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

### When to Use

- Verifying a layout/CSS change to an admin (sidebar-shell) page landed, without booting a browser
- Writing a regression assertion that a page no longer contains a specific style (e.g. `height: 100vh`)
- Confirming `fullHeightTargets` / content-only frame targets actually take effect for a route

(Consolidated from `remix3-frame-rendered-html-verification`)

---

## Frame Target Registration & Content-Only Panels

**Context:** Moving admin agent routes under `/admin` with a sidebar, embedding a nested "panel" frame that loads other admin pages. Two symptoms appeared in sequence: a duplicate MainNav navbar in the panel, then a duplicate sidebar.

### Problem

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

### When to Use

- Embedding a nested `<Frame>` (panel) inside a page that already renders a sidebar layout, where the panel loads other admin/content routes
- After changing a frame's `name`, `data-active-frame`, or SSE navigate `target` — the frame name becomes the `X-Remix-Target`, and the layout must know it
- Seeing a second navbar or second sidebar appear inside a frame
- Seeing sidebar navigation "jump into" the wrong (inner) frame

(Consolidated from `remix3-frame-target-registration`)

---

## Frame Input Value Preservation

**Context:** When a Remix Frame reloads with new server-rendered HTML containing `<input value="...">`, the `defaultValue` is silently ignored. The input keeps its previous value (or stays empty).

### Problem

Remix Frames use DOM diffing (`diff-dom.js`) instead of full replacement when updating content on `frame.reload()`. When an `<input>` element is matched by tag and position, `diffElementAttributes` is called. For the `value` attribute, `shouldPreserveLiveAttribute` checks:

```javascript
if (name === 'value') {
  if (current instanceof HTMLInputElement &&
      next instanceof HTMLInputElement &&
      shouldPreserveInputValue(current)) {
    return current.value !== next.value;  // true → SKIP the update
  }
}
```

When `current.value` differs from `next.value` (e.g. empty string vs "fritz"), the check returns `true`, meaning **preserve the current value**. `setAttribute('value')` is skipped entirely. The server-rendered `defaultValue` is never applied.

This affects:
- Filter/search inputs with `defaultValue={filterParam}` on Frame-reloaded pages
- Any form input that relies on `defaultValue` inside a Remix Frame
- GET form submissions with `rmx-target` that navigate the frame

### Solution

Set the input's `.value` property **directly after the frame reload completes**, bypassing the DOM diff:

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

### When to Use

- Server-rendered form inputs with `defaultValue` inside a Remix `<Frame>` don't show the expected value after navigation
- Filter/search inputs are empty after a Frame reload even though the URL has the correct query parameter
- The frame content updates but `<input>` elements keep their old values

(Consolidated from `remix-frame-input-value-preservation`)

---

## Remix 3 clientEntry Authoring Constraints (SSR-safe DOM, mixin placement, asset-server imports)

**Context:** Three distinct failures when authoring a new remix/ui `clientEntry`:
`ReferenceError: document is not defined` during server render, TS/JSX parse errors
from misplaced mixins, and `AssetServerCompilationError: IMPORT_NOT_ALLOWED`.

### Problem

1. **SSR `document is not defined`** — calling `document.*` in the clientEntry
   function body (outside a `ref` callback / event handler) executes during
   server-side render, where `document` doesn't exist. The request still returns
   200 but the server logs a stack trace pointing at the component body.
2. **`ref` and `on` are mixins, not JSX attributes** — they must live inside
   `mix={[...]}`, not as standalone `ref={...}` / `on('click', ...)` attributes.
   Standalone usage throws TS1003/TS1382 parser errors.
3. **`.filter(Boolean)` breaks `on` type inference** — a mix array containing a
   `false` literal (from `cond && css({...})`) widens the element type to include
   `boolean`, so `on('keydown', ...)` falls back to `EventType<Element>` and
   rejects `keydown`/`click`. Use a spread conditional instead.
4. **Asset server import boundary** — client entries are compiled by the asset
   server whose `allowFiles` (in `app/assets.ts`) only permits
   `app/**/*.browser.*`, `app/assets/entry.tsx`, `app/routes.ts`, `app/ui/**`,
   `app/utils/**`. A pure helper imported from outside those (e.g.
   `app/actions/lists/lists-keyboard.ts`) fails with `IMPORT_NOT_ALLOWED`.

### Solution

1. Do all DOM work inside `ref()` callbacks (client-only), or guard top-level
   reads with `if (typeof document === 'undefined') return`.
2. Put `ref`/`on` mixins inside `mix={[...]}`.
3. For conditional mix entries next to `on`/`ref`, use the spread form:
   `...(cond ? [css({...})] : [])` — never `cond && css(...)` + `.filter(Boolean)`.
4. Put shared pure logic used by client entries in `app/utils/` (with the
   `.test.ts` colocated), and import it via `../../utils/...`.

### When to Use

- Any new `clientEntry` in a Remix 3 app
- `ReferenceError: document is not defined` logged during a `.browser.tsx` request
- `AssetServerCompilationError: IMPORT_NOT_ALLOWED` on a client-entry import
- TS parse errors on `ref={...}` / `on(...)` used as standalone attributes

(Consolidated from `remix3-cliententry-authoring-constraints`)
