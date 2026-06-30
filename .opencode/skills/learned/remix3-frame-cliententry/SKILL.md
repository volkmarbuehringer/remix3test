---
name: remix3-frame-cliententry
description: "Consolidated patterns for Remix 3 Frame navigation and clientEntry lifecycle management"
user-invocable: false
origin: consolidated
---

# Remix 3 Frame Navigation & clientEntry Patterns

Remix 3's `<Frame>` component and `clientEntry` hydration model form a tightly coupled lifecycle. Frames intercept GET navigations via the browser Navigation API, replacing DOM content server-side without full-page reloads. `clientEntry` components hydrate inside those frames, attaching event listeners and managing interactive state. However, the interaction between these two systems produces several hard-to-debug failure modes: POST submissions bypass Frame interception entirely, `handle.update()` infinite loops fire at page sizes over 50 entries, `mounted` guards silently break after Frame DOM replacement, and binary responses crash the frame router. This document consolidates patterns for working within these constraints — covering form validation errors, cascade limits, mounted-guard fixes, CSS scoping across serialization boundaries, DOM-based inline editing, the `on` mixin's hydration requirement, binary downloads, and mobile hamburger navigation.

## Table of Contents
- [Post Form Submissions in Frames](#post-form-submissions-in-frames)
- [clientEntry Cascade Limit](#cliententry-cascade-limit)
- [mounted Guard After Frame Reload](#mounted-guard-after-frame-reload)
- [CSS Child Selectors for clientEntry](#css-child-selectors-for-cliententry)
- [Inline-Edit Server-Rendered Table Cells](#inline-edit-server-rendered-table-cells)
- [on Mixin Requires clientEntry](#on-mixin-requires-cliententry)
- [Binary File Downloads in Frames](#binary-file-downloads-in-frames)
- [Mobile Nav Hamburger](#mobile-nav-hamburger)

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
return renderAdminPage(context.render, 'resource',
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
return renderAdminPage(context.render, 'resource',
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
      if (activeCell) { commitEdit(); return }  // save current, don't open new
      startEdit(cell)
    }

    return () => {
      if (typeof document !== 'undefined') {
        let table = document.querySelector<HTMLElement>('#my-table')
        if (!table) return <div mix={css({ display: 'none' })} />

        table.addEventListener('click', onCellClick)

        handle.signal.addEventListener('abort', () => {
          table.removeEventListener('click', onCellClick)  // same ref
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
      if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
    }

    function onInputBlur() {
      if (!saving) commitEdit()
    }

    function commitEdit() {
      if (!activeInput || !activeCell || !activeRowId) return
      let newValue = activeInput.value.trim()
      if (!newValue || newValue === originalValue) { revertCell(); return }

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
            handle.frame.reload().catch(() => {})  // ⚠️ frame.reload() returns a Promise
          } else {
            let data = await res.json().catch(() => ({ error: 'Save failed' }))
            saving = false
            showError(data.error || 'Save failed')
          }
        })
        .catch(() => { saving = false; showError('Network error') })
    }

    function cancelEdit() { revertCell() }

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
<td
  data-inline-edit="email"
  tabindex={0}
  role="button"
  aria-label={`Edit email: ${row.email}`}
>{row.email}</td>
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

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Anonymous arrow in addEventListener | removeEventListener silently fails → memory leak | Store handler in named variable |
| Not guarding `saving` flag | Race condition: two saves fire simultaneously | `if (saving) return` at top of click handler |
| Not catching `handle.frame.reload()` | Unhandled promise rejection on network error | `.catch(() => {})` |
| InnerHTML instead of textContent | XSS vulnerability if cell contains user data | Always use `.textContent` |

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

Using the `on` event mixin from `remix/ui` in a server-rendered Remix 3 component (not wrapped in `clientEntry`) compiles without errors but the event handler **never fires** on the client. Attempts to use raw HTML event attributes (`onsubmit`, `onclick`) as string props also fail with TypeScript errors.

#### What was tried (all failed)

```tsx
// ❌ TypeScript error — 'onsubmit' not a valid prop
<form onsubmit="return confirm('Wirklich löschen?')">

// ❌ Compiles, but handler never fires (server-rendered component)
import { on } from 'remix/ui'
<form mix={on('submit', (e) => { if (!confirm('...')) e.preventDefault() })}>

// ❌ Same — compiles but never fires
<Button mix={on('click', () => { if (!confirm('...')) return })}>
```

### Root Cause

The `on` mixin generates event handler code that only gets hydrated when the component is a `clientEntry`. In server-rendered components, the mixin output is static HTML with no client-side JavaScript to attach the handler.

### Solution

Wrap the interactive element in a `clientEntry` component. This is the established pattern in the codebase (see `admin-action-button.tsx`, `admin-offerings-context-menu.tsx`).

```tsx
// ✅ Works — clientEntry ensures the on() handler is hydrated
import { clientEntry, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from 'remix/ui/button'

interface DeleteButtonProps extends SerializableProps {
  csrfToken: string
  offset: string
  sort: string
  order: string
  filter: string
  period: string
}

export const DeletePastButton = clientEntry(
  import.meta.url + '#DeletePastButton',
  function DeletePastButton(handle: Handle<DeleteButtonProps>) {
    return () => {
      let clickHandler = on<HTMLButtonElement>('click', () => {
        if (!confirm('Wirklich löschen?')) return
        // Build and submit form programmatically, or use fetch()
        let form = document.createElement('form')
        form.method = 'POST'
        form.action = '/target/url'
        // ... add hidden inputs ...
        document.body.appendChild(form)
        form.submit()
        form.remove()
      })

      return <Button type="button" tone="danger" mix={clickHandler}>Löschen</Button>
    }
  },
)
```

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
        <ThemeToggle />   {/* ← mounted on every page */}
      </body>
    </html>
  )
}
```

Remove duplicate mounts from `<Layout>` — `<Document>` is the single root wrapper for all routes, and `clientEntry` components use an `initialized` flag to prevent duplicate hydration.

**Key points:**
- Props must extend `SerializableProps` (strings, numbers, booleans, null — no functions)
- Use `import.meta.url + '#ComponentName'` as the entry ID
- The `on` handler is written in setup scope (inside the `return () => {` closure) so it has stable references
- For form submission, create the form programmatically in the handler, or use `fetch()` + `handle.frame.reload()` (see `admin-action-button.tsx`)

### When to Use

- Adding `confirm()` dialogs to admin action buttons
- Any event-driven interactivity (click, submit, input) in server-rendered Remix 3 pages
- When `on` mixin compiles but the handler doesn't fire — immediately suspect missing `clientEntry`
- Before reaching for inline `<script>` tags or raw DOM manipulation outside the component system

(Consolidated from `remix-on-mixin-requires-cliententry`)

---

## Binary File Downloads in Frames

# Binary File Downloads in Remix 3 Frame Navigation

**Context:** Adding a PDF download route to a Remix 3 app that uses `<Frame>` navigation — the frame router intercepted the link click and tried to render the binary PDF response as HTML, causing `Node.insertBefore: Cannot insert a Text as a child of a Document`.

### Problem

When a Remix 3 app uses `<Frame>` navigation, clicking a link to a binary download endpoint (PDF, CSV, ZIP, etc.) causes the frame router to:

1. Intercept the click
2. Fetch the URL with `Accept: text/html` and `X-Remix-Frame: true` headers
3. Try to parse the binary response as a component tree

This produces a cryptic DOM error: `Node.insertBefore: Cannot insert a Text as a child of a Document`

The same URL works on browser reload because the full-page navigation skips the frame router.

### Solution

Two changes are needed — one on the link, one on the server:

#### 1. Bypass frame navigation on the link

Add `rmx-document` attribute to any `<a>` tag pointing to a binary download:

```tsx
<a href={routes.export.pdf.index.href()} rmx-document>
  PDF herunterladen
</a>
```

This tells the Remix navigation runtime to skip frame interception for this link (handled in `navigation.ts` line 148: `if (linkElement.hasAttribute('rmx-document')) return`).

#### 2. Guard the controller against frame requests

If someone navigates to the URL directly while inside a frame (e.g., types it in the address bar), the request still carries `X-Remix-Frame: true`. Redirect to force a full-page navigation:

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

#### Full example

```tsx
// Controller
export default createController(routes.export.pdf, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      if (context.request.headers.get('X-Remix-Frame') === 'true') {
        let url = new URL(context.url)
        return new Response(null, {
          status: 302,
          headers: { Location: url.href },
        })
      }
      let buffer = await generatePdf()
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="export.pdf"',
        },
      })
    },
  },
})
```

#### Error symptom

```
Error: Node.insertBefore: Cannot insert a Text as a child of a Document
```

This error appears in the browser when the frame router tries to mount binary data as a component tree. If you see it, check whether the URL is a binary download being loaded through frame navigation.

### When to Use

- Adding any route that returns binary content (`Content-Type: application/pdf`, `text/csv`, `application/zip`, etc.) in a Remix 3 app that uses `<Frame>` navigation
- Debugging `Node.insertBefore` DOM errors in a Remix 3 app
- When a download link works on page reload but crashes on first click from a frame context

(Consolidated from `remix-frame-binary-download`)

---

## Mobile Nav Hamburger

# Remix 3 Mobile Nav Hamburger Pattern

**Context:** Building a responsive navbar that replaces desktop horizontal links with a hamburger-triggered full-screen overlay on mobile

### Problem

A desktop horizontal nav bar with 6-8 items overflows on mobile screens. You need a hamburger menu that:
- Replaces the desktop nav links on mobile with a curated set of action-oriented items
- Uses a full-screen overlay (not a slide drawer or dropdown)
- Manages focus correctly (keyboard trap prevention)
- Locks body scroll when open
- Has proper `aria-expanded`, `role="dialog"`, `aria-modal` for accessibility
- Closes on: ✕ button, backdrop tap, nav link click, Escape key
- Works within Remix 3's `clientEntry` hydration model (clientEntry must live in `app/assets/`, not `app/ui/`)

### Solution

#### 1. Nav Data Layer (`app/ui/nav.ts`)

Define mobile-specific items alongside desktop `NAV_SECTIONS`:

```typescript
export type MobileNavItem = {
  label: string
  href: string
  requireAuth: boolean
  cta?: boolean  // true = styled as primary CTA button
}

export const MOBILE_ITEMS: MobileNavItem[] = [
  { label: 'Neuer Termin', href: '/appointments/new', requireAuth: true, cta: true },
  { label: 'Einstellungen', href: '/settings', requireAuth: true },
]
```

#### 2. Client Entry for Toggle (`app/assets/nav-toggle.tsx`)

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(handle: Handle) {
    let initialized = false
    let previousFocus: HTMLElement | null = null

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        let drawer = document.getElementById('nav-drawer')
        let btn = document.getElementById('nav-toggle')
        if (!drawer || !btn) return

        btn.addEventListener('click', () => toggle())

        // Escape key: scoped to drawer, not document (avoids cross-page leaks)
        drawer.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close()
        })

        // Close on any tap inside the drawer (backdrop, links, close button)
        drawer.addEventListener('click', () => close())

        function toggle() {
          let isOpen = drawer!.classList.toggle('is-open')
          btn!.setAttribute('aria-expanded', String(isOpen))
          document.body.style.overflow = isOpen ? 'hidden' : ''
          if (isOpen) {
            previousFocus = document.activeElement as HTMLElement
            let closeBtn = document.getElementById('nav-close')
            if (closeBtn) closeBtn.focus()
          } else if (previousFocus) {
            previousFocus.focus()
            previousFocus = null
          }
        }

        function close() {
          if (drawer!.classList.contains('is-open')) toggle()
        }
      }
      return null
    }
  },
)
```

Key design decisions:
- **Close on any drawer click**: simplifies the handler — no need to check `el.closest('a')` etc., because navigation already handles link clicks; tapping padding/gaps should also close
- **Escape listener on the drawer element**, not `document` — prevents cross-page listener leaks
- **Focus management**: store `document.activeElement` before opening, restore it on close
- **Body scroll lock**: `document.body.style.overflow = 'hidden'` / `''`
- **`aria-expanded` sync**: kept in the client entry alongside the class toggle

#### 3. CSS Strategy (`app/ui/main-nav.tsx`)

Use paired media query constants for the responsive switch:

```typescript
// Hides desktop nav on mobile
const desktopOnlyCss = css({
  '@media (max-width: 768px)': {
    display: 'none',
  },
})

// Shows hamburger on mobile only
const mobileOnlyCss = css({
  display: 'none',
  '@media (max-width: 768px)': {
    display: 'flex',
  },
})

// Full-screen overlay (hidden by default, shown via .is-open)
const navDrawerCss = css({
  display: 'none',
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  flexDirection: 'column',
  background: theme.surface.lvl0,
  '&.is-open': { display: 'flex' },
  // Force-hide on desktop in case drawer is left open after resize
  '@media (min-width: 769px)': {
    display: 'none !important',
  },
})
```

⚠️ **Breakpoint pairing**: Use `max-width: 768px` for mobile rules and `min-width: 769px` for desktop rules. These are contiguous — no gap at exactly 768px. Document the pairing with comments so they stay in sync.

#### 4. Template Structure (`app/ui/main-nav.tsx`)

```
<header>
  <div nav-inner>
    <a logo/>

    <nav desktop-links mix={[navLinksCss, desktopOnlyCss]}>
      NAV_SECTIONS items, settings, login/logout
    </nav>

    <div hamburger-wrapper mix={[headerActionsCss, mobileOnlyCss]}>
      <button id="nav-toggle" aria-expanded="false" aria-controls="nav-drawer" />
    </div>

    <button id="theme-toggle" />  ← always visible on both desktop/mobile
  </div>

  <NavToggle />  ← non-visual, registers event listeners

  <div id="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation" mix={navDrawerCss}>
    <div drawer-header>
      <a logo />
      <button id="nav-close" />
    </div>
    <div drawer-body>
      {user ? <CTA /> + settings link + logout form : <login link />}
    </div>
  </div>
</header>
```

#### 5. Auth-Gated Content

Read auth state via `getCurrentUserSafely()` and CSRF token via `getCsrfToken(getContext())`:

```typescript
let user = getCurrentUserSafely()
let csrfToken: string | undefined
try {
  csrfToken = getCsrfToken(getContext())
} catch { /* CSRF may not be active */ }
```

Render mobile items based on auth state:
- **Logged in**: show items where `requireAuth: true`, plus logout form with CSRF
- **Logged out**: show only login link

Style the primary CTA as an indigo button matching the desktop login button pattern:
```typescript
const drawerCtaCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  color: 'white',
  textDecoration: 'none',
  fontSize: '1.125rem',
  fontWeight: 600,
  padding: '0.75rem 2rem',
  borderRadius: theme.radius.md,
  background: indigo[600],
  '&:hover': { background: indigo[700] },
})
```

### When to Use

Use this pattern when:

- Adding a responsive hamburger menu to a Remix 3 app that currently has a horizontal desktop nav bar
- You need a full-screen overlay (not a slide drawer or dropdown) for mobile navigation
- You want proper accessibility (focus management, aria attributes) with the `clientEntry` hydration model
- The mobile nav needs different/curated items than the desktop nav (auth-gated CTAs vs full nav tree)
- You're working in a Remix 3 codebase that uses `remix/ui`'s `css()` and `clientEntry` patterns

Do NOT use when:
- You need a slide-in drawer or bottom tab bar (this pattern is specifically a full-screen overlay)
- The app isn't using Remix 3's `remix/ui` component model
- You need animation/transition on the overlay (this pattern uses instant pop)

(Consolidated from `remix-mobile-nav-hamburger`)
