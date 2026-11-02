# Stubbing Browser Geometry to Test clientEntry Side Effects

**Source:** `remix3-cliententry-browser-test-stubs`

**Extracted:** 2026-09-13
**Context:** Adding browser coverage for `app/ui/appointments-new-create.browser.tsx` (resets a scroll container when the panel's `getBoundingClientRect().top < 0`) and `app/ui/appointments-new-resource-search.browser.tsx` (delegated `input`/`keydown` listener) in the Remix 3 app at `/appointments/new`.

## Problem

`render(...)` from `remix/component/test` mounts a component and `result.act(...)` flushes
`handle.queueTask`, which is enough for event-driven entries. It is **not** enough when the
entry's side effect depends on browser geometry or media state:

- The entry only acts when `element.getBoundingClientRect().top < 0` (or similar), which is
  never true in a freshly mounted test container with no viewport-relative layout.
- The entry branches on `window.matchMedia('(max-width: 768px)')`, whose result depends on the
  Playwright project's viewport.
- The entry calls `scrollTo`/`scrollIntoView`, which a test container with no real layout
  scrolls nowhere, so there is nothing to assert.

Reading `element.scrollHeight`/`clientHeight`, or overriding `scrollTo`, also trips TypeScript:
`scrollTo` is overloaded and read-only DOM getters resist plain assignment.

## Solution

The vendor guide `node_modules/remix/guides/13-testing.md` already documents `render`/`act`/`cleanup`. This skill is the delta: build a controlled DOM fixture the entry will query, stub the geometry/measurement APIs it reads with `Object.defineProperty(..., { configurable: true })`, render, and flush with `result.act(() => {})`; then observe the side-effect call.

Reference implementation: `app/ui/appointments-new.test.browser.tsx:28` (`domRect`), `:42` (`stubMatchMedia`), `:155` (positive/negative fixture test). It covers:

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

## Pitfalls

- **A stub that is never called makes an "assert zero calls" test pass vacuously.** Always pair
  the not-called case with a positive case that proves the entry ran (see the two
  `CreatePanelScrollLive` tests).
- **Module-scoped delegated listeners outlive a test.** A `document.addEventListener` registered
  by the entry (often guarded by a module-level `listenerRegistered` flag) persists across tests
  in the same browser page. Scope queries to `result.container` and remove fixtures in `afterEach`.
- **Clean up the fixture, not just the render root.** Entries that query
  `document.querySelector('[data-...]')` will match an earlier test's leftover fixture; remove it
  in `afterEach` even when an assertion throws.
- **`matchMedia` must be stubbed per test and restored.** The Playwright project viewport decides
  the responsive branch, so `(max-width: 768px)` is not stable across projects; set `matches`
  explicitly and restore the original in `afterEach`.
- **Prefer `Object.defineProperty(el, 'scrollTo'|'scrollHeight'|'clientHeight', { configurable: true })`**
  over assigning the property: these are inherited, some read-only, and `scrollTo` is overloaded,
  so a plain assignment needs an ugly `as unknown as` cast and may not compile.
- **Run the file explicitly:** `NODE_ENV=test npx remix test app/ui/<name>.test.browser.tsx`
  executes every configured project (this repo: `chromium` + `firefox`).

## When to Use

- Writing a `*.test.browser.tsx` for a `clientEntry` whose behavior depends on
  `getBoundingClientRect`, `scrollHeight`/`clientHeight`, `matchMedia`,
  `scrollTo`/`scrollIntoView`, or other layout/measurement APIs.
- A test asserts "nothing happened" for a geometry-driven branch and you need a matching positive case.
- Adding regression coverage for responsive (mobile vs desktop) client-entry code.

For the production counterpart — running a side effect once per frame navigation by keying on a
server-rendered `data-*` attribute and `handle.queueTask` — see `remix3-frame-cliententry`.
