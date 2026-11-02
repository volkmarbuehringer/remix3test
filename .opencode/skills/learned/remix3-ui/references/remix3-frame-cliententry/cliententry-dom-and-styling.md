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

`clientEntry` props must be JSON-serializable — a plain `interface` type-checks, but functions and non-serializable objects are rejected at the type level. CSS `MixinDescriptor` objects (produced by `css()`) are **not** serializable, so you cannot pass `btnMix` or similar styling props to a `clientEntry` component. This blocks the common joined "Edit | Del" button group.

Use **parent-container CSS with child selectors** instead of passing mixins as props:

```tsx
const actionBtnGroup = css({
  display: 'inline-flex',
  alignItems: 'stretch',
  // Edit is the direct <a>; Del is inside <form><button/></form>.
  '& > a': { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' },
  '& > form > button': { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
})

<div mix={actionBtnGroup}>
  <a href={editUrl} mix={buttonLink({ tone: 'secondary' })}>Edit</a>
  <DelButton action={delUrl} ... />
</div>
```

The CSS targets the known DOM structure: Edit is the direct `<a>` → `& > a`; Del is inside `<form><button/></form>` → `& > form > button`. `remix/component` scopes `&` to the generated class, so child combinators reach nested elements without passing CSS objects through serializable prop boundaries.

### Never nest a button inside a link

A link that navigates (`href` + `data-rmx-target`) must not wrap a `<button>`: `<a><button>…</button></a>` is invalid HTML and drops the link role for assistive tech. Style the **anchor** itself as a button.

The shared theme helper `app/ui/theme/button.ts` exports `buttonLink()` for this. `button()` is bound to `HTMLButtonElement` (the recursive `MixinDescriptor` relation is order-sensitive — see `typescript-gotchas` (`references/ts7-order-sensitive-type-relations.md`)), so applying it directly to an `<a>` is a `TS2322`; `buttonLink()` rebinds the host element type to `HTMLAnchorElement`. The upstream contract supports non-button hosts — it applies `type="button"` only to native `<button>` hosts and otherwise adds styling only.

```tsx
import { buttonLink } from '../ui/theme/button.ts'

// BAD — invalid nesting, link semantics lost
<a href={editUrl} data-rmx-target={frameTarget}>
  <button mix={button({ tone: 'secondary' })}>Edit</button>
</a>

// GOOD — the link carries the button styles
<a href={editUrl} data-rmx-target={frameTarget} mix={buttonLink({ tone: 'secondary' })}>
  Edit
</a>
```

For a grid row action this also keeps the action cell narrow: use an icon-only `buttonLink` with `aria-label` + `title`.

Use when creating joined button groups where one button is a `clientEntry` component, styling children of a container that wraps `clientEntry` components, or any pattern where you'd pass a CSS mixin as a prop but the child is a `clientEntry`.

## Joining a Button Group with 3+ Buttons (per-button styles)

**Context:** Building a joined flat button group (edit | delete | move-up | move-down) on a direct child of a row in a `remix/component` app, mirroring the `/admin/lists` row-action group.

The container child-selector approach works for a **two**-button group (first = left radius, last = right radius). For **3+ direct buttons**, styling via a container rule is unreliable: the `button()` mixin's pill styles (`borderRadius: 999px`) can win the layer contest, leaving egg-shaped buttons with no shared vertical border.

Apply flat square styles **per button** instead. Only the first gets the left radius, only the last the right; middle buttons stay perfectly square. Mark contested borders `!important` (see the cascade pitfall below).

Reference implementation: `app/ui/mixins/segmented.ts:1-80` (`segmentedButton({ isFirst, isLast })`), with the `/admin/lists` icon variant in `app/actions/lists/public/lists-styles.ts:1064-1100` (`iconActionStyle`). Mix order per button: base, then first/last/danger.

### Radius pitfall (double-rounded corners)

Only the **first** button gets the left radius and only the **last** gets the right radius; middle buttons must stay perfectly square (no radius). If you bake the left radius into every button (as a 2-button group would), a 3+ button group shows a rounded corner between each adjacent pair.

### Cascade pitfall: per-button styles can still lose on one button

"Per-button" is necessary but not always sufficient. Every `css()` rule lives in its own `@layer rmx.<class>` sub-layer, and inside `rmx` the sub-layer registered last wins **regardless of specificity** — so when a button also carries the vendor `button()` mixin, the mixin's `border` shorthand can win on whichever button happens to be registered first. The visible symptom is one segment (usually the **active, primary-tone** one, whose own border is `0`) keeping a full border while its siblings are flattened.

The period/status switchers were fixed by marking the two contested declarations `!important` in the per-button class (`app/ui/mixins/segmented.ts`). Full mechanism, alternatives (re-render the markup with app styles, declare a later layer) and the CDP recipe: `remix3-css-and-layout` → `references/cascade-layer-overrides.md`.

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

#### Implementation shape

One entry per page; use click delegation and DOM replacement rather than per-row entries:

```tsx
export const InlineEdit = clientEntry(import.meta.url + '#InlineEdit', (handle) => {
  let activeCell: HTMLTableCellElement | null = null
  let saving = false

  function onCellClick(e: Event) { ... } // named: same ref for removeEventListener

  return () => {
    // find the table, addEventListener('click', onCellClick), remove on handle.signal abort
  }

  function startEdit(cell: HTMLTableCellElement) { /* swap textContent for <input type="email"> */ }
  function commitEdit() { /* fetch PUT + JSON/CSRF; on ok cleanup(); handle.frame.reload().catch(() => {}) */ }
  function revertCell() { /* restore originalValue via textContent */ }
})
```

The UI stays a single server-rendered table; the entry only mutates the active cell. Commit on Enter/blur, revert on Escape; on a failed save append a small text node to the cell and keep the input focused.

#### Server-Side Wiring

The server-rendered table needs:

1. **`data-inline-edit`** on editable cells
2. **`data-row-id`** on each `<tr>` (see `app/actions/client/grid-page.tsx:413`)
3. **CSRF token** embedded (e.g. `<script id="grid-state" ...>` or `<meta name="csrf-token">`)
4. **`tabindex={0}`, `role="button"`, `aria-label`** on editable cells for keyboard access
5. **Controller** must accept `Content-Type: application/json` bodies for partial updates

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

Using the `on` event mixin from `remix/component` in a server-rendered component (not wrapped in `clientEntry`) compiles without errors but the event handler **never fires** on the client. Raw HTML event attributes (`onsubmit`, `onclick`) as string props also fail with TypeScript errors. The `on` mixin's handler code only gets hydrated when the component is a `clientEntry` — otherwise the mixin output is static HTML with no client-side JS.

Wrap the interactive element in a `clientEntry` component. Props must be serializable (strings, numbers, booleans, null, and plain objects/arrays of those — no functions, no `css()` mixin descriptors); `extends SerializableProps` is **not** required since build `a4d62e199` (#11918), so use a plain `interface`. The entry ID is `import.meta.url + '#ComponentName'`. The `on` handler goes in setup scope (inside the `return () => {` closure) so it has stable references. For form submission, create the form programmatically in the handler, or use `fetch()` + `handle.frame.reload()` (the deleted `admin-action-button.tsx` was replaced by server-rendered submit buttons; current examples are `app/actions/client/public/grid-refresh-button.tsx` and `app/actions/lists/public/list-name-edit.tsx` — app re-checked 2026-10-14).

#### Where to Mount Global clientEntry Behaviors

A `clientEntry` that registers global event listeners (e.g., theme toggle, analytics, keyboard shortcuts) must mount in the **root `<Document>` wrapper**, not `<Layout>`. Pages rendered directly through `<Document>` (standalone landing pages) never mount `<Layout>`, so the `clientEntry` never hydrates and the feature silently breaks.

Mount it once in `app/ui/document.tsx:37` (`Document`), the single root wrapper every page renders — standalone pages skip `<Layout>`, so a `<Layout>` mount silently never hydrates. Remove duplicate mounts; the `clientEntry`'s `initialized` flag prevents double hydration.

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
export const MyList = clientEntry(import.meta.url + '#MyList', (handle) => {
  let items = [...]
  return () => (
    <div>
      {items.map((item, index) => (
        <div key={item.id} draggable="true" data-index={index}
          mix={ref((el) => {
            let ac = new AbortController()
            for (let type of ['dragstart', 'dragover', 'drop', 'dragend'] as const) {
              el.addEventListener(type, (e) => {
                let idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10)
                onDrag(type, e as DragEvent, idx) // dispatch to the handlers below
              }, { signal: ac.signal })
            }
            return () => ac.abort()
          })}
        >...</div>
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

let handleDragStart = (e: DragEvent) => {
  draggedEl = e.currentTarget as HTMLElement
  draggedEl.style.opacity = '0.4'
}

let handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  if (indicatorEl) indicatorEl.style.borderTop = '2px solid blue'
}

let handleDrop = () => {
  items = reorderedItems
  handle.update() // only after the drop, never during dragover
}

let handleDragEnd = () => {
  if (draggedEl) draggedEl.style.opacity = ''
  if (indicatorEl) indicatorEl.style.borderTop = ''
  if (draggedEl || indicatorEl) handle.update()
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
// ❌ inline <script> never executes in a frame response
<div id="chat-messages">{messages}</div>
<div id="chat-end" />

// ✅ anchor inside the scroller → native fragment scrolling
<div id="chat-messages" mix={conversationStyle}>
  {messages}
  <div id="chat-end" />
</div>
```

```ts
return redirect(routes.chat.index.href() + '?threadId=' + id + '#chat-end')
```

How it works: the browser parses the URL hash, finds the element with the matching `id`, walks up the DOM tree to the first ancestor with `overflow: auto` or `overflow: scroll`, and scrolls that ancestor to make the target visible (at the bottom if it's the last child). The container needs `overflow-y: auto` (or `scroll`).

Use when a chat/message page needs scroll-to-bottom after form submission, inline `<script>` tags don't work (frame navigation/content injection), you want scroll-to-bottom without a `clientEntry`, or fragment scrolling works at page level but fails inside scrollable divs.
