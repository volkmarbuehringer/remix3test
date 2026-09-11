# clientEntry DOM and Styling Patterns

## What This Covers

DOM mutation and CSS patterns that live inside (or around) a `clientEntry`. Read this when the task involves:

- Styling children of a `clientEntry` component when mixins can't cross the serializable prop boundary
- Building a joined button group with 2 or 3+ buttons
- Inline-editing server-rendered table cells with a single entry
- An `on(...)` handler that compiles but never fires
- HTML5 drag-and-drop reordering inside an entry
- Scroll-to-bottom of an overflow container without a client-side script

For event listeners re-attaching after frame reload, see `cliententry-lifecycle.md`. For frame/forms wiring, see `frame-navigation.md`.

## CSS Child Selectors for clientEntry

**Context:** Creating a joined "Edit | Del" button group where the parent needs to style child Button components inside a `clientEntry` component.

`clientEntry` components extend `SerializableProps` — only JSON-serializable values can be passed as props. CSS `MixinDescriptor` objects (produced by `css()`) are **not** serializable, so you cannot pass `btnMix` or similar styling props to a `clientEntry` component. This blocks the common joined "Edit | Del" button group.

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

The CSS targets the known DOM structure: Edit is inside `<a><button/></a>` → `& > a > button`; Del is inside `<form><button/></form>` (from DelButton) → `& > form > button`. `remix/ui` CSS-in-JS uses scoped selectors, so `&` resolves to the generated scoped class; combined with child combinators (`>`) you can target nested elements without passing CSS objects through serializable prop boundaries.

Use when creating joined button groups where one button is a `clientEntry` component, styling children of a container that wraps `clientEntry` components, or any pattern where you'd pass a CSS mixin as a prop but the child is a `clientEntry`.

## Joining a Button Group with 3+ Buttons (per-button styles)

**Context:** Building a joined flat button group (edit | delete | move-up | move-down) on a direct child of a row in a `remix/ui` app, mirroring the `/admin/lists` row-action group.

The container child-selector approach works for a **two**-button group (first = left radius, last = right radius). For **3+ direct buttons**, styling via a container rule is unreliable in this `css()` runtime — the `button()` mixin's pill styles (`borderRadius: 999px`) can win, leaving egg-shaped buttons with no shared vertical border.

Apply the flat square styles **per-button** instead of via a container `> button` rule — exactly how `/admin/lists` does it with its own `iconActionStyle`:

```tsx
let iconActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRight: 'none', // shared border — every button drops its right border
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
})
// First button gets the left radius; last button restores right border + radius.
let iconActionFirstStyle = css({ borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}` })
let iconActionLastStyle = css({
  borderRight: `1px solid ${theme.colors.border.default}`,
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
})
// Danger (delete) button hover treatment.
let iconActionDangerStyle = css({
  color: theme.colors.action.danger.background,
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})
```

Per-button mix arrays (order: base, then first/last/danger):

- First button: `[iconActionStyle, iconActionFirstStyle]`
- Middle buttons: `[iconActionStyle]` (square, no radius)
- Last button: `[iconActionStyle, iconActionLastStyle]`
- Delete: `[iconActionStyle, iconActionDangerStyle]`

### Radius pitfall (double-rounded corners)

Only the **first** button gets the left radius and only the **last** gets the right radius; middle buttons must stay perfectly square (no radius). If you bake the left radius into every button (as a 2-button group would), a 3+ button group shows a rounded corner between each adjacent pair.

### Cascade pitfall: per-button styles can still lose on one button

"Per-button" is necessary but not always sufficient. Every `css()` rule lives in its own `@layer rmx.<class>` sub-layer, and inside `rmx` the sub-layer registered last wins **regardless of specificity** — so when a button also carries the vendor `button()` mixin, the mixin's `border` shorthand can win on whichever button happens to be registered first. The visible symptom is one segment (usually the **active, primary-tone** one, whose own border is `0`) keeping a full border while its siblings are flattened.

The period/status switchers were fixed by marking the two contested declarations `!important` in the per-button class (`app/ui/mixins/segmented.ts`). Full mechanism, alternatives (re-render the markup with app styles, declare a later layer) and the CDP recipe: `remix3-css-override-cascade-layer`.

## Inline-Edit Server-Rendered Table Cells

**Context:** Adding an editable email column to a server-rendered admin table using one `clientEntry` component (not per-row).

A naive approach creates one `clientEntry` per row (`N` hydrations, `N` closured states), causing `handle.update()` issues. Use a **single** `clientEntry` per page. Since the table is owned by the server component, the clientEntry cannot re-render individual cells via its render function. Instead, use **DOM manipulation** to replace cell content with an `<input>`.

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

Use when adding inline editing to an existing server-rendered table, admin CRUD interfaces where one `clientEntry` should manage all rows, or any pattern where a `clientEntry` edits DOM it doesn't own.

## on Mixin Requires clientEntry

**Context:** Adding a "Vergangene löschen" button with a `confirm()` dialog to an admin offerings page in a Remix 3 project.

Using the `on` event mixin from `remix/ui` in a server-rendered component (not wrapped in `clientEntry`) compiles without errors but the event handler **never fires** on the client. Raw HTML event attributes (`onsubmit`, `onclick`) as string props also fail with TypeScript errors. The `on` mixin's handler code only gets hydrated when the component is a `clientEntry` — otherwise the mixin output is static HTML with no client-side JS.

Wrap the interactive element in a `clientEntry` component. Props must extend `SerializableProps` (strings, numbers, booleans, null — no functions), and the entry ID is `import.meta.url + '#ComponentName'`. The `on` handler goes in setup scope (inside the `return () => {` closure) so it has stable references. For form submission, create the form programmatically in the handler, or use `fetch()` + `handle.frame.reload()` (see `admin-action-button.tsx`).

#### Where to Mount Global clientEntry Behaviors

A `clientEntry` that registers global event listeners (e.g., theme toggle, analytics, keyboard shortcuts) must mount in the **root `<Document>` wrapper**, not `<Layout>`. Pages rendered directly through `<Document>` (standalone landing pages) never mount `<Layout>`, so the `clientEntry` never hydrates and the feature silently breaks.

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

Use when the `on` mixin compiles but the handler doesn't fire (suspect missing `clientEntry`), adding `confirm()` dialogs to admin action buttons, or mounting a global behavior `clientEntry` so it hydrates on every page (Document, not Layout).

## HTML5 Drag and Drop in clientEntry

**Context:** Implementing drag-and-drop reordering of list items in a `clientEntry` component.

Adding HTML5 Drag and Drop (`dragstart`, `dragover`, `drop`, `dragend`) to a Remix 3 `clientEntry` hits three issues:

1. **`on()` mixin rejects drag events** — `on('dragstart', handler)` fails TypeScript because `EventType<Element>` (the target type for JSX elements) does not include HTML5 drag events. Only `HTMLElementEventMap` includes them, but the template system targets `Element`.
2. **`handle.update()` during drag causes infinite loop** — calling `handle.update()` inside `dragover` (which fires on every mouse pixel) triggers a re-render that the scheduler detects as cascading updates and throws `Error: handle.update() infinite loop detected`.
3. **Stale closures after key-based reorder** — after a successful drop, `handle.update()` re-renders the list. Key-based reconciliation reuses DOM elements, so `ref()` callbacks **don't re-fire**. Event listener closures keep the **old** `index` value, corrupting subsequent drag operations.

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

Use when implementing drag-and-drop reordering in a `clientEntry`, getting TypeScript errors from `on('dragstart', ...)`/`on('dragover', ...)`, getting `handle.update() infinite loop detected` during drag, or drag working once then breaking after reordering.

## Fragment Scrolling Inside Overflow Containers

**Context:** A Remix 3 chat page needed to scroll the message container to the bottom after POST+redirect, but inline `<script>` tags don't execute in frame navigation because content is fetched via `router.fetch()` and injected into the DOM.

Inline `<script>` tags in frame responses **do not execute**. This blocks client-side scroll-to-bottom patterns like `document.getElementById('chat-messages').scrollTop = ...`. `clientEntry` works but adds complexity (separate file, async hydration, lifecycle management).

Place a `<div id="your-target" />` **inside** the scrollable overflow container (`overflow-y: auto`), then navigate to the URL with `#your-target` hash. The browser's native fragment scrolling finds the **nearest scrollable ancestor** of the target element and scrolls THAT container.

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

How it works: the browser parses the URL hash, finds the element with the matching `id`, walks up the DOM tree to the first ancestor with `overflow: auto` or `overflow: scroll`, and scrolls that ancestor to make the target visible (at the bottom if it's the last child). The container needs `overflow-y: auto` (or `scroll`).

Use when a chat/message page needs scroll-to-bottom after form submission, inline `<script>` tags don't work (frame navigation/content injection), you want scroll-to-bottom without a `clientEntry`, or fragment scrolling works at page level but fails inside scrollable divs.
