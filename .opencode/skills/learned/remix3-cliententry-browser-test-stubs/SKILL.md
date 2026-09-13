---
name: remix3-cliententry-browser-test-stubs
description: "Use when a Remix 3 `*.test.browser.tsx` must assert a `clientEntry`'s geometry- or measurement-driven DOM side effect (scroll reset, responsive `matchMedia` branch, `getBoundingClientRect` read) that `render`/`act` alone cannot drive — build a controlled fixture and stub the platform APIs with `Object.defineProperty`."
metadata:
  origin: auto-extracted
---

# Stubbing Browser Geometry to Test clientEntry Side Effects

**Extracted:** 2026-09-13
**Context:** Adding browser coverage for `app/ui/appointments-new-create.browser.tsx` (resets a scroll container when the panel's `getBoundingClientRect().top < 0`) and `app/ui/appointments-new-resource-search.browser.tsx` (delegated `input`/`keydown` listener) in the Remix 3 app at `/appointments/new`.

## Problem

`render(...)` from `remix/ui/test` mounts a component and `result.act(...)` flushes
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

The vendor `remix/references/testing-patterns.md` already documents `render`/`act`/`cleanup`.
This skill is the delta: build a **controlled DOM fixture** the entry will query, stub the
geometry/measurement APIs it reads, and observe the side-effect call it makes.

```tsx
import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import { CreatePanelScrollLive } from './appointments-new-create.browser.tsx'

function domRect(top: number): DOMRect {
  return {
    x: 0, y: top, width: 0, height: 0, top, right: 0, bottom: top, left: 0,
    toJSON: () => ({}),
  }
}

function stubMatchMedia(matches: boolean): () => void {
  let original = window.matchMedia
  // matchMedia returns a full MediaQueryList; the entry only reads `.matches`.
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe('Create panel reveal', () => {
  let restoreMatchMedia: (() => void) | undefined
  let scroller: HTMLElement | undefined

  afterEach(() => {
    restoreMatchMedia?.()
    scroller?.remove()
  })

  it('resets the scroll container when the panel header is above the fold', async () => {
    restoreMatchMedia = stubMatchMedia(false) // force the desktop branch

    let outer = document.createElement('div')
    outer.style.overflowY = 'auto'
    // findScrollParent() checks scrollHeight > clientHeight; force it on an unlaid-out node.
    Object.defineProperty(outer, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(outer, 'clientHeight', { value: 200, configurable: true })
    let panel = document.createElement('div')
    panel.setAttribute('data-create-panel', 'true')
    panel.setAttribute('data-panel-step', 'create:2')
    outer.appendChild(panel)
    document.body.appendChild(outer)
    scroller = outer

    panel.getBoundingClientRect = () => domRect(-120) // header scrolled above the fold

    let scrollCalls: ScrollToOptions[] = []
    // Neutralize the side effect and record it. defineProperty avoids the overloaded-method cast.
    Object.defineProperty(outer, 'scrollTo', {
      configurable: true,
      value: (options?: ScrollToOptions | number) => {
        if (typeof options === 'object') scrollCalls.push(options)
      },
    })

    let result = render(<CreatePanelScrollLive />)
    await result.act(() => {}) // flush the mount queueTask
    assert.equal(scrollCalls.length, 1)
    assert.equal(scrollCalls[0]?.top, 0)

    // Pair the negative case with a positive one, or "no call" passes vacuously.
    outer.remove()
    result.cleanup()
  })
})
```

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
