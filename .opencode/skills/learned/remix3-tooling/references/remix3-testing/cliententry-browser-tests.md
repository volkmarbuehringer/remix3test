# Browser-Testing clientEntry Enhancements

**Source:** consolidated from `remix3-cliententry-browser-test-stubs`, the document-scoped full-page pattern (session 2026-10-04), and the frame-event synthetic-handle pattern.
**Extracted:** 2026-09-13 … 2026-10-04
**Revalidated:** 2026-11-04 against the current test harness (`remix/component/test` `render`/`act`/`cleanup`).
**Context:** Three shapes of `*.test.browser.tsx` coverage for a `clientEntry`: geometry/media-driven side effects, full-page document-scoped enhancers, and frame-event state machines (`reloadStart`/`reloadComplete`). The vendor guide `node_modules/remix/guides/13-testing.md` owns the generic `render`/`act`/`cleanup` API; this reference is the app delta.

## 1. Geometry and media stubs

`render(...)` mounts a component and `result.act(...)` flushes `handle.queueTask`, which is enough for event-driven entries. It is **not** enough when the side effect depends on browser geometry or media state:

- The entry only acts when `element.getBoundingClientRect().top < 0` (or similar), never true in a freshly mounted test container with no viewport-relative layout.
- The entry branches on `window.matchMedia('(max-width: 768px)')`, whose result depends on the Playwright project's viewport.
- The entry calls `scrollTo`/`scrollIntoView`, which a test container with no real layout scrolls nowhere.

Reading `element.scrollHeight`/`clientHeight`, or overriding `scrollTo`, also trips TypeScript: `scrollTo` is overloaded and read-only DOM getters resist plain assignment.

Build a controlled DOM fixture the entry will query, stub the geometry/measurement APIs it reads with `Object.defineProperty(..., { configurable: true })`, render, and flush with `result.act(() => {})`; then observe the side-effect call.

Reference implementation: `app/ui/appointments-new.test.browser.tsx` (`domRect`, `stubMatchMedia`, positive/negative fixture test). It covers:

- a panel whose `getBoundingClientRect().top < 0` (force a `DOMRect` stub),
- a scroll parent with forced `scrollHeight`/`clientHeight`,
- `scrollTo` replaced by a recording stub,
- `matchMedia` stubbed per test and restored in `afterEach`.

For a delegated listener entry, drive the DOM event and flush with `act`:

```tsx
let result = render(<ResourceCards resources={resources} gridState={gridState} />)
await result.act(() => {})
let input = result.container.querySelector<HTMLInputElement>('[data-resource-search]')
if (!input) throw new Error('search input should render')

await result.act(() => {
  input.value = 'Raum'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
assert.equal(visibleCards(result.container).length, 2)
```

## 2. Full-page, document-scoped entries

Most full-page entries in this app are the opposite of the guide's self-contained component: the `clientEntry` renders only a hidden marker and does all its work in a `ref` callback that queries `document` and registers delegated listeners on `document`/`window` (e.g. `lists-sidebar-keyboard.tsx`, `lists-row-actions.tsx`). Three failure modes follow:

1. **Fixture placement** — a fixture appended to `result.container` is invisible to `document.querySelector`, so nothing happens and the test fails with a misleading "no effect".
2. **State bleed** — the entry writes `location.hash`/`history.replaceState` (ARIA tabs, deep links), so one test's hash deep-links the next test's mount.
3. **Fixture infidelity** — the fixture must mirror the server-rendered markup. `Glyph` renders only `xlink:href` (see `remix3-ui` § Theme Tokens → `references/remix3-theme-conformance/glyph-add.md`), so a fixture with a plain `href` asserts a different attribute than the entry writes.

Build the fixture as real DOM appended to `document.body`, keep a handle to remove it, and assert against the fixture (not `result.container`).

```tsx
import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsSidebarKeyboard } from './lists-sidebar-keyboard.tsx'

const ROWS_HTML = `
  <div data-list-id="1">
    <a href="/lists?load=1"><span data-list-name>Alpha</span></a>
  </div>
  <div data-list-id="2">
    <a href="/lists?load=2"><span data-list-name>Beta</span></a>
  </div>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html: string): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html // mirror the server-rendered markup
  document.body.appendChild(host) // the entry queries document, not result.container
  fixture = host
  return host
}

beforeEach(() => {
  // Tab/deep-link code writes the hash via history.replaceState; clear it or the
  // next test mounts already deep-linked.
  history.replaceState(null, '', window.location.pathname + window.location.search)
})

afterEach(() => {
  cleanup?.() // dispose the render root
  cleanup = null
  fixture?.remove() // even when an assertion threw: document listeners persist
  fixture = null
})

describe('ListsSidebarKeyboard', () => {
  it('installs a roving tab stop on the row anchors', () => {
    let host = mount(ROWS_HTML)
    cleanup = render(<ListsSidebarKeyboard />).cleanup

    let first = host.querySelector('[data-list-id="1"] a[href]') as HTMLAnchorElement
    let second = host.querySelector('[data-list-id="2"] a[href]') as HTMLAnchorElement
    assert.equal(first.getAttribute('tabindex'), '0')
    assert.equal(second.getAttribute('tabindex'), '-1')
  })
})
```

- `render()` supplies a root frame, so entries that only *listen* for `handle.frame` events mount with no extra setup. Stub `frameInit.resolveFrame` only when the test triggers `handle.frame.reload()`.
- Module-scoped registration guards (`let listenersRegistered = false`) attach delegated listeners once per document; `cleanup()` does not remove them. Every test still needs its own fixture.
- Programmatic `.click()` on a tab anchor is safe (same-document hash change); never trigger `location.reload`/`assign` — see `test-harness-gotchas.md`.

## 3. Frame events: synthetic `Handle`

A `clientEntry` may key behavior on the enclosing frame's `reloadStart`/`reloadComplete` events (loading state, pre-swap flush, post-swap re-read). `render(<Entry ... />)` mounts the entry inside a root frame, so its listeners attach, but `RenderResult` exposes only `container`, `root`, `$`, `$$`, `act`, and `cleanup` — **not the entry's `frame`** — so there is no handle to dispatch on. A real frame navigation (form submit, `handle.frame.reload`) is e2e territory.

Call the `clientEntry` factory **directly** with a synthetic `Handle` whose `frame` is a plain `EventTarget`, and re-render into the test root on `update`. This is the pattern in `app/ui/pending-submit.test.browser.tsx`; the `/lists` loading test (`lists-loading.test.browser.tsx`) uses the same `mountWithFrame` helper, which supplies `{ frame: new EventTarget(), props, signal, queueTask, update }` and returns `{ result, frame, dispose }`.

```tsx
let mounted = mountWithFrame(state())
mounted.frame.dispatchEvent(new Event('reloadStart'))
assert.ok(mounted.result.container.querySelector('[data-loading-list]'))

// reloadComplete reads the server marker the frame would have swapped in.
document.body.appendChild(markerWith(state()))
mounted.frame.dispatchEvent(new Event('reloadComplete'))
assert.ok(mounted.result.container.querySelector('#lists-title'))
```

## 4. Shared pitfalls

- **A stub that is never called makes an "assert zero calls" test pass vacuously.** Pair the not-called case with a positive case that proves the entry ran.
- **Module-scoped delegated listeners outlive a test.** Scope queries to `result.container` (self-contained entries) or the fixture (document-scoped entries), and remove fixtures in `afterEach` even when an assertion throws.
- **`matchMedia` must be stubbed per test and restored.** The Playwright project viewport decides the responsive branch, so `(max-width: 768px)` is not stable across projects.
- **Prefer `Object.defineProperty(el, 'scrollTo'|'scrollHeight'|'clientHeight', { configurable: true })`** over assigning the property: these are inherited, some read-only, and `scrollTo` is overloaded, so a plain assignment needs an `as unknown as` cast.
- **Don't scope document-scoped assertions to `result.container`.** The rendered marker is `display:none` and contains none of the UI; assert on the fixture host.
- **Reset the hash in `beforeEach`, not after.** Anchor clicks and `history.replaceState` mutate the iframe URL, and the next `init()` reads it.
- **Synthesise only what the frame-event factory touches at construction.** With `initialState` supplied the entry takes its initial branch and never reads `document.getElementById('lists-initial-state')` on mount; `reloadComplete` does, so add the marker to `document.body` (and remove it in `afterEach`) before firing that event.
- **The synthetic handle needs `frame`, `props`, `signal`, `update`.** `handle.update()` must re-render through `result.root.render(...)`; `handle.signal` must be a real `AbortSignal` because the factory passes it to native `addEventListener` (Bun rejects the SSR stub). Abort it in `afterEach`.
- **Stub `queueTask` when the exercised path opens a picker/dialog.** On the minimal synthetic handle it is `undefined`, so the click handler throws *after* setting dialog state: the dialog appears empty, and the search request that would fill it never runs. Add `queueTask: (task) => task()` or queue/drain it.
- **Hold the mutation response to test frame-navigation races.** Return a manually resolved promise from the `fetch` stub, dispatch `reloadStart`, swap in a different marker, dispatch `reloadComplete`, then resolve. Assert the new rows remain and the stale action is surfaced as cancelled.
- **This bypasses hydration.** Assert the entry's own render output, and keep one e2e for the real navigation wiring.
- **Both engines run.** Keep assertions engine-neutral (no `networkidle`, no native `<select>` change assumptions — see `test-harness-gotchas.md`).
- **Run the file explicitly:** `NODE_ENV=test npx remix test app/ui/<name>.test.browser.tsx` executes every configured project (this repo: `chromium` + `firefox`).

## When to Use

- A `*.test.browser.tsx` must assert a `clientEntry` side effect driven by `getBoundingClientRect`, `scrollHeight`/`clientHeight`, `matchMedia`, or `scrollTo`/`scrollIntoView`.
- A `*.test.browser.tsx` targets a full-page `clientEntry` that queries `document`/`window`; browser tests pass alone but fail together, or a test sees an unexpected active tab/panel.
- A `*.test.browser.tsx` must drive `reloadStart`/`reloadComplete` (loading/pending state, pre-swap flush, post-swap re-read), and `render(<Entry/>)` gives no frame handle.
- You are adding regression coverage for a geometry-driven or responsive branch and need a matching positive case.
