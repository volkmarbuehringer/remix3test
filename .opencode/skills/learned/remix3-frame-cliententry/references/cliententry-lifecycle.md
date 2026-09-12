# clientEntry Lifecycle

## What This Covers

The mount, hydration, re-render, and disposal traps of a `clientEntry`. Read this when the task involves:

- A frame with many `clientEntry` components crashing with `handle.update() infinite loop detected`
- Interaction that silently stops working after sort/paginate/filter in a frame
- Loading data when the enclosing frame navigates to a different URL
- Registering global `document`/`window` listeners from an entry
- SSR-safety, mixin placement, and asset-server import constraints for a new entry

For the frame/forms contract, see `frame-navigation.md`. For CSS/DOM patterns, see `cliententry-dom-and-styling.md`.

## clientEntry Cascade Limit

**Context:** A Remix 3 Frame that hosts 50+ `clientEntry` components (e.g., per-row delete buttons in a grid table) crashes on pagination with `handle.update() infinite loop detected`.

A Remix 3 Frame's grid crashes with `Error: handle.update() infinite loop detected` when the page size is large enough to produce 50+ rows, but only on **subsequent page loads** (pagination, sort, filter), not on the initial load.

> **Note (per #11795, 2026-09-08):** `handle.update()` is now phase-guarded in `~/remix/packages/ui/src/runtime/component.ts`. Called during **setup** it warns and skips; called during **render** (or before the initial commit, outside setup) it **throws** `Cannot call handle.update() while X is running its <phase> function`. The older cascading guard `handle.update() infinite loop detected` (`~/remix/packages/ui/src/runtime/scheduler.ts:129`) still fires for async cascades. Either symptom is the same class of bug — call `handle.update()` only from an event handler or `handle.queueTask()`, never from a render function, a `dragover`/resize/scroll handler, or a setup-time effect.

**Root cause chain:**

1. All `clientEntry` hydrations within a single Frame share that Frame's scheduler (`scheduler.ts`)
2. The scheduler's `cascadingUpdateCount` increments on every `flush()` call
3. On the **first load**, modules aren't cached yet — hydrations happen asynchronously in separate microtasks, giving `setTimeout(0)` a chance to reset the counter
4. On **subsequent loads** (pagination), modules are already in `context.moduleCache`, so all hydrations run **synchronously** without yielding to the event loop, accumulating the counter past `MAX_CASCADING_UPDATES = 50`
5. The error fires at counter value 51 (`> 50`), even though no actual infinite loop exists

**Solution:** reduce the number of `clientEntry` components within the Frame to stay below the 50 threshold:

1. **Replace per-row clientEntry with server-rendered forms** — use standard `<form method="POST" data-rmx-target="<frame-name>" data-confirm="...">` instead of per-row `clientEntry` delete buttons
2. **Use event delegation** — a single `clientEntry` can handle all row actions via DOM event delegation (e.g., `target.closest('tr[data-row-id]')`)
3. **Embed row data as JSON** in a `<script id="...-table-data" type="application/json">` tag for the delegated handler to read

Server-rendered forms inside a Frame need `<CsrfTokenInput />`, `<input type="hidden" name="_method" value="DELETE" />` for method override, hidden inputs for offset/sort/order/filter state, `data-rmx-target="<frame-name>"` for frame-aware submission without full page navigation, and a redirect to the grid fragment URL (e.g., `/client/grid`) not the full page URL (`/client`).

Use when a frame crashes with `handle.update() infinite loop detected` during pagination, you have many `clientEntry` components (50+) inside a single Frame, or the error appears only on cached (second+) renders.

## mounted Guard After Frame Reload

**Context:** All admin context menus stopped working after sort/paginate/filter in a Remix 3 Frame-based admin panel. The root cause was a `let mounted = false` guard in each `clientEntry` closure that prevented re-attaching event listeners after Frame DOM replacement.

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

**Solution:** replace the `mounted` guard with one of three patterns depending on the component architecture.

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

The `mounted` guard is unnecessary for `ref()` callbacks because `ref()` fires only on DOM insertion (not on `handle.update()`), on Frame navigation the old element is removed and a new one is inserted → `ref()` fires again, and `handle.signal` cleanup ensures no listener leaks when the component is disposed.

Use when a `clientEntry` with listeners or DOM interactions silently stops working after Frame-targeted navigation, you see `let mounted = false` (or `let initialized = false`) guarding `addEventListener`/`document.getElementById`, or in admin grid context menus / inline edit controls inside a `<Frame>`.

## Post-Navigation Data Loading in clientEntry

**Context:** A `clientEntry` editor needs to load a different resource when the user clicks a sidebar link targeting the frame — the URL changes but the `clientEntry` closure is preserved.

A `clientEntry` reads its initial data from `location.search` (or a DOM attribute) on first hydration. When the enclosing `<Frame>` navigates to a different URL, the entry needs to detect the change and reload data. The **render function IS re-called** after frame navigation (the factory closure persists, only the render function re-runs), but calling `handle.update()` inside the render function has **timing issues**, and reading `location.search` is unreliable because address-bar updates may not be synchronized with the frame's actual URL. Symptoms: "click loads the list the first time, but subsequent clicks on different sidebar entries don't load anything" or "the form is blocking reloading after the first navigation".

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

The `reloadComplete` event fires in the `finally` block after the frame's new content is rendered (`~/remix/packages/ui/src/runtime/frame.ts:883`, dispatched by `completeReload` defined at `:878`; the inherited-reload variant dispatches at `:918`). At this point `handle.frame.src` contains the just-rendered URL.

### Frame-Only Navigation (replace `window.location.href`)

When you need to programmatically navigate the frame (e.g., after saving data), use the `handle.frame.src` + `handle.frame.reload()` pattern instead of `window.location.href`:

```typescript
function navigateFrame(href: string) {
  handle.frame.src = href
  handle.frame.reload().catch(() => {}) // returns Promise — suppress unhandled rejection
}
```

The `.catch(() => {})` is required because `handle.frame.reload()` returns a `Promise<AbortSignal>` and may reject on network errors.

### Avoiding Race Conditions (AbortController)

If the user clicks sidebar entries rapidly, multiple `reloadComplete` events can fire while previous fetches are still in flight. Cancel the previous fetch:

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

Use when a `clientEntry` inside a `<Frame>` must reload data on frame URL changes, the editor works on first load but stops responding to sidebar/frame clicks, you see `let initialized = false` guarding reads from `location.search`/DOM attributes, or rapid sidebar clicks show stale data. Complementary to the mounted-guard patterns above — use both when the component has listeners AND needs to reload data.

## Registering Global Document Listeners from a clientEntry

**Context:** A `clientEntry` needs a global `document`/`window` listener (e.g., a delegated `dragstart` handler for sidebar rows that live outside the entry's own JSX). This records the *timing* trap.

> Line references below revalidated 2026-09-11 against `remix` 3.0.0-rc.2 (`@remix-run/ui` d7eb6b18); `~/remix` `packages/ui/src/runtime/` is in sync for these files.

### `ref()` does fire on hydration — the real trap is deferred hydration

A `document.addEventListener` inside a `ref()` on a stable root can *appear* never to register, but the cause is not SSR-vs-hydration insertion. Verified against the pinned vendor tree:

- `ref()` is driven by the mixin `insert` event (`packages/ui/src/runtime/mixins/ref-mixin.ts:16`).
- During hydration the reconciler adopts a matching SSR element and calls `bindNodeMixRuntime(...)` **without** `reclaimed` (`packages/ui/src/runtime/reconcile.ts:905`, `:944`), so `insert` is dispatched on the client and `ref()` fires at hydration.
- The `reclaimed` variant, which skips `insert`, is only selected by `reclaimPersistedMixinNode` (`runtime/reconcile.ts:914`, `:2146`) for mixin-persisted nodes — not for plain hydration.

What actually breaks is **timing**. Client entries hydrate lazily (deferred import map, notably slow in Firefox — see `remix3-firefox-single-import-map`), so no listener exists until the entry's factory body and first render have run. A `setTimeout(0)` scheduled earlier in the page lifecycle, or a synthetic event dispatched as soon as the SSR-rendered markup appears, fires before that. The same applies to a *manual* check: dispatching events immediately after load proves nothing.

### Solution

For one-time global setup, register the delegated listener once in the `clientEntry` factory body, guarded by `typeof document !== 'undefined'`:

```typescript
// ... all handlers defined above ...
if (typeof document !== 'undefined') {
  document.addEventListener('dragstart', onDocumentDragStart, { signal: handle.signal })
  document.addEventListener('dragend', onDocumentDragEnd, { signal: handle.signal })
}
```

The factory body runs **once per mount** — only the returned render function re-runs on `handle.update()` — so a separate `installed` flag is not load-bearing. The `document` guard makes it a no-op during SSR, and on the client it runs before the first render. `ref()` on a stable root is equally valid; pick whichever owns the element.

### Testing a clientEntry drag gesture (e2e)

**SSR markup looks the same before and after hydration, so waiting for a control the entry renders proves nothing.** A `clientEntry` is server-rendered too, so its toolbar/controls are already in the initial HTML; hydration happens later, when the deferred module loads. Asserting on that markup, or dispatching events as soon as it appears, silently tests nothing.

Observe a side effect of the handler instead. For a confirm-gated gesture, override `window.confirm` so it records that it was called, then drive the gesture until the count increases:

```typescript
await page.evaluate(() => {
  let root = document.documentElement
  root.dataset.confirmCalls = '0'
  window.confirm = () => {
    root.dataset.confirmCalls = String(Number(root.dataset.confirmCalls ?? '0') + 1)
    return false // decline: applies nothing, so retries are harmless
  }
})

let calls = 0
for (let attempt = 0; attempt < 60 && calls === 0; attempt++) {
  await dragList(page, sourceId, targetId) // one synthetic dragstart/dragover/drop
  await page.waitForTimeout(250)
  calls = Number(await page.evaluate(() => document.documentElement.dataset.confirmCalls))
}
assert.ok(calls > 0, 'the drag must be handled once the client entry hydrates')
```

Two rules keep this honest:

- **Stop dispatching as soon as the handler runs** when the gesture applies something. Retrying *after* a merge/mutation was issued can apply it twice; retrying only *before* the handler has run cannot.
- **Assert on a side effect, not on absence.** "Nothing changed" also passes when the drag was never handled — the prompt count is what distinguishes a declined gesture from an unhandled one.

Also guard `e.dataTransfer` before touching it in drag handlers — Firefox ignores the `dataTransfer` init-dict in `new DragEvent('dragstart', { dataTransfer })`, so it is `null` in synthetic events:

```typescript
if (e.dataTransfer) {
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('text/x-list-id', String(sourceId))
}
```

**Scope of that caveat (re-checked on Firefox 155, 2026-09-10):** it is a `dragstart` limitation, not a general one. `dragover` and `drop` events built with `new DragEvent(type, { dataTransfer })` **do** carry `dataTransfer.types`, so a test can assert on the payload kind there — the uploads drop-guard tests read `types.includes('Files')` from a synthetic `dragover`/`drop` pair and pass in the Firefox project (`app/actions/admin/uploads/uploads-dropzone.test.e2e.ts`). Keep the defensive `if (e.dataTransfer)` guard in handlers regardless, and do not assume a `dataTransfer` set in a synthetic `dragstart` survives to the later events of the same gesture.

## clientEntry Authoring Constraints (SSR-safe DOM, mixin placement, asset-server imports)

**Context:** Distinct failures when authoring a new remix/ui `clientEntry`: `ReferenceError: document is not defined` during server render, TS/JSX parse errors from misplaced mixins, `AssetServerCompilationError: IMPORT_NOT_ALLOWED`, and a hydrated entry that replaces the whole document with the error card.

1. **SSR `document is not defined`** — calling `document.*` in the clientEntry function body (outside a `ref` callback / event handler) executes during server-side render, where `document` doesn't exist. The request still returns 200 but the server logs a stack trace pointing at the component body.
2. **`ref` and `on` are mixins, not JSX attributes** — they must live inside `mix={[...]}`, not as standalone `ref={...}` / `on('click', ...)` attributes. Standalone usage throws TS1003/TS1382 parser errors.
3. **`.filter(Boolean)` breaks `on` type inference** — a mix array containing a `false` literal (from `cond && css({...})`) widens the element type to include `boolean`, so `on('keydown', ...)` falls back to `EventType<Element>` and rejects `keydown`/`click`. Use a spread conditional instead.
4. **Asset server import boundary** — client entries are compiled by the asset server whose `allowFiles` (in `app/assets.ts`) only permits `app/**/*.browser.*`, `app/assets/entry.tsx`, `app/routes.ts`, `app/ui/**`, `app/utils/**`. A pure helper imported from outside those (e.g. `app/actions/lists/lists-keyboard.ts`) fails with `IMPORT_NOT_ALLOWED`.
5. **`css()` mixins inside serialized props are destroyed** — a `clientEntry`'s props cross the client boundary by JSON serialization (`createHydrationPropsReplacer`/`transformProps`). A mix descriptor is passed through as-is, and its `type` is a function, so `JSON.stringify` drops it. The client revives `{ args: [...] }` with `type: undefined` and hydration throws `Framework invariant: Invalid mix prop`; because the app's error boundary then swaps the document for the error card, the symptom reads as "the whole page becomes Unexpected Error the moment the entry hydrates". Verified 2026-09-12 in `/home/lucky/remix3test` on the pinned build: the serialized entry props contain `"mix":[{"args":[…minHeight…]}]` with no `type` key, the failing element was a `<div mix={css({...})}>` passed as a `LazyFrame` fallback/children prop, and replacing it with a plain string fixed it (Chromium + Firefox e2e). This is exactly why the upstream `lazy-frames` demo styles `LazyFrame` placeholders from the server-rendered shell — its README notes placeholder mixins cannot cross the boundary. An entry's **own** render output is safe: `css()` on the element the entry returns is composed during SSR and re-created with a live `type` on the client, so the mixin may live there.

**Solution:**

1. Do all DOM work inside `ref()` callbacks (client-only), or guard top-level reads with `if (typeof document === 'undefined') return`.
2. Put `ref`/`on` mixins inside `mix={[...]}`.
3. For conditional mix entries next to `on`/`ref`, use the spread form: `...(cond ? [css({...})] : [])` — never `cond && css(...)` + `.filter(Boolean)`.
4. Put shared pure logic used by client entries in `app/utils/` (with the `.test.ts` colocated), and import it via `../../utils/...`.
5. Keep `css()` off every element passed as a `clientEntry` **prop** (`children`, `fallback`, …): pass plain text/markup and style it from the server-rendered parent's `css()`, or render the styled wrapper inside the entry's own render function. Grep the entry's props for `mix=` before shipping.

Use for any new `clientEntry` in a Remix 3 app, `ReferenceError: document is not defined` logged during a `.browser.tsx` request, `AssetServerCompilationError: IMPORT_NOT_ALLOWED` on a client-entry import, TS parse errors on `ref={...}`/`on(...)` used as standalone attributes, or a document-wide "Unexpected Error / Invalid mix prop" error card appearing as soon as a client entry hydrates.
