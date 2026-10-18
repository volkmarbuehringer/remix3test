# Testing clientEntry Frame Events (`reloadStart` / `reloadComplete`)

## Problem

A `clientEntry` keys behavior on the enclosing frame's `reloadStart` / `reloadComplete` events — showing a loading state for the swap, flushing a pending edit before the frame navigates, re-reading server state after it does. A `*.test.browser.tsx` needs to drive that state machine without a real navigation.

`render(<Entry ... />)` mounts the entry inside a root frame, so its listeners attach, but `RenderResult` exposes only `container`, `root`, `$`, `$$`, `act`, and `cleanup` — **not the entry's `frame`** — so there is no handle to dispatch `reloadStart`/`reloadComplete` on. A real frame navigation (form submit, `handle.frame.reload`) is e2e territory and cannot be asserted inside a browser test.

## Solution

Call the `clientEntry` factory **directly** with a synthetic `Handle` whose `frame` is a plain `EventTarget`, and re-render into the test root on `update`. This is the pattern in `app/ui/pending-submit.test.browser.tsx`; the loading-state test for `/lists` (`app/actions/lists/public/lists-loading.test.browser.tsx`) reuses it for a full entry.

```tsx
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'
import { ListsClient } from './lists-client.tsx'

function mountWithFrame(initial: ListInitialState) {
  let frame = new EventTarget()            // the entry only addEventListener()s on it
  let controller = new AbortController()   // becomes handle.signal; abort on cleanup
  let inner: (() => RemixNode) | null = null
  let resultRef: RenderResult | null = null

  let handle = {
    frame,
    props: { initialState: initial },
    signal: controller.signal,
    // Entries that open a picker/dialog focus via queueTask during the
    // exercised path; without this the click throws and the follow-up
    // search/render never runs.
    queueTask: (task: () => void) => {
      task()
    },
    // Production re-runs the render function through the runtime; here the same
    // function re-renders into the test root.
    update: () => {
      if (resultRef && inner) resultRef.root.render(<div>{inner()}</div>)
    },
  } as unknown as Handle<{ initialState?: ListInitialState | null }>

  inner = ListsClient(handle) as unknown as () => RemixNode
  resultRef = render(<div>{inner()}</div>)
  return { result: resultRef, frame, dispose: () => { controller.abort(); resultRef?.cleanup() } }
}

it('shows loading between reloadStart and reloadComplete', () => {
  let mounted = mountWithFrame(state())
  assert.ok(mounted.result.container.querySelector('#lists-title'))

  mounted.frame.dispatchEvent(new Event('reloadStart'))
  assert.ok(mounted.result.container.querySelector('[data-loading-list]'))

  // reloadComplete reads the server marker the frame would have swapped in.
  let marker = document.createElement('div')
  marker.id = 'lists-initial-state'
  marker.setAttribute('data-state', JSON.stringify(state()))
  document.body.appendChild(marker)
  mounted.frame.dispatchEvent(new Event('reloadComplete'))

  assert.ok(mounted.result.container.querySelector('#lists-title'))
})
```

## Pitfalls

- **Synthesise only what the factory touches at construction.** With `initialState` supplied the entry takes its initial branch and never reads `document.getElementById('lists-initial-state')` on mount; `reloadComplete` does, so add the marker to `document.body` (and remove it in `afterEach`) when you fire that event.
- **The synthetic handle needs `frame`, `props`, `signal`, `update`.** `handle.update()` must re-render through `result.root.render(...)`; `handle.signal` must be a real `AbortSignal` because the factory passes it to native `addEventListener` (Bun rejects the SSR stub — see `remix3-bun-runtime`). Abort it in `afterEach` so the document/window listeners the factory registered are removed.
- **Stub `queueTask` when the exercised path opens a picker/dialog.** A real `clientEntry` focuses newly revealed UI with `handle.queueTask(...)`. On the minimal synthetic handle that method is `undefined`, so the click handler throws *after* setting the dialog state: the dialog appears in its loading/empty state, but nothing after the `queueTask` call runs — including the search request that fills the picker. Add `queueTask: (task) => task()` (or queue and drain it after the render) to `mountWithFrame`. This bit the `/lists` target-picker test even though the existing loading test passed.
- **Hold the mutation response to test frame-navigation races.** Return a manually resolved promise from the `fetch` stub for the mutation; dispatch `reloadStart`, swap in a different `#lists-initial-state` marker, dispatch `reloadComplete`, then resolve the response. Assert the new list's rows remain and the stale action is surfaced as cancelled. Without the deferred response the race cannot be reproduced in a browser test — the same harness also proves the source-id guard.
- **This bypasses hydration.** You assert the entry's own render output, not the server→client handoff. Keep one e2e that drives the real navigation for the wiring.
- **Don't try to dispatch on a real frame.** `render(<Entry/>)` does not expose it; stubbing `frameInit.resolveFrame` only helps when the test itself calls `handle.frame.reload()` (see `document-scoped-cliententry-browser-tests.md`).

## When to Use

- A `*.test.browser.tsx` must assert a `clientEntry`'s `reloadStart`/`reloadComplete` behavior: a loading/pending state toggled across the swap, a pre-swap edit flush, or post-swap hydration.
- The behavior is pure state-machine logic the entry owns, and the real trigger is a frame navigation you do not want to reproduce in a browser test.
