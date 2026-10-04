# Browser-Testing Full-Page, Document-Scoped clientEntry Enhancements

**Source:** `remix3-testing` (session 2026-10-04)
**Extracted:** 2026-10-04
**Context:** Adding isolated browser coverage for `app/ui/settings-enhance.browser.tsx` (the
`/settings` entry) and `app/actions/lists/public/{lists-row-actions,lists-sidebar-keyboard}.tsx`.
Complements `cliententry-browser-test-stubs.md` (geometry/media stubs); this delta covers fixture
ownership, state reset, and fixture fidelity for entries that query `document` instead of rendering
their own DOM.

## Problem

The vendor guide's browser-test example mounts a self-contained component and queries
`result.container`. Most full-page entries in this app are the opposite shape: the `clientEntry`
renders only a hidden marker `<div>` and does all its work in a `ref` callback that queries
`document` and registers delegated listeners on `document`/`window`. Three failure modes follow:

1. **Fixture placement** — a fixture appended to `result.container` is invisible to
   `document.querySelector`, so nothing happens and the test fails with a misleading "no effect".
2. **State bleed** — the entry writes `location.hash`/`history.replaceState` (ARIA tabs, deep
   links), so one test's hash deep-links the next test's mount.
3. **Fixture infidelity** — the fixture must mirror the server-rendered markup. `Glyph` renders
   only `xlink:href` (see `remix3-theme-conformance → references/glyph-add.md`), so a fixture with
   a plain `href` asserts a different attribute than the entry writes.

## Solution

Build the fixture as real DOM appended to `document.body`, keep a handle to remove it, and assert
against the fixture (not `result.container`).

```tsx
import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { SettingsEnhance } from './settings-enhance.browser.tsx'

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html: string): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html            // mirror the server-rendered markup
  document.body.appendChild(host)  // the entry queries document, not result.container
  fixture = host
  return host
}

beforeEach(() => {
  // Tab code writes `#<panel>` via history.replaceState; clear it or the next
  // test mounts already deep-linked.
  history.replaceState(null, '', window.location.pathname + window.location.search)
})

afterEach(() => {
  cleanup?.()        // dispose the render root
  cleanup = null
  fixture?.remove()  // even when an assertion threw: document listeners persist
  fixture = null
})

describe('SettingsEnhance tabs', () => {
  it('activates a tab when it is clicked', () => {
    let host = mount(tabsHtml('settings-profile'))
    cleanup = render(<SettingsEnhance />).cleanup

    let tab = host.querySelector('[data-settings-tab][aria-controls="settings-password"]') as HTMLElement
    tab.click()
    assert.equal(host.querySelector('#settings-password')?.hasAttribute('hidden'), false)
  })
})
```

- `render()` supplies a root frame, so entries that only *listen* for `handle.frame` events
  (`handle.frame.addEventListener('reloadComplete', …)`) mount with no extra setup. Stub
  `frameInit.resolveFrame` only when the test triggers `handle.frame.reload()`.
- Module-scoped registration guards (`let listenersRegistered = false`) attach the delegated
  listeners once per document; do not expect `cleanup()` to remove them. Every test still needs its
  own fixture.
- Programmatic `.click()` on a tab anchor is safe (same-document hash change); never trigger
  `location.reload`/`assign` — see `location-reload-unforgeable.md`.

## Pitfalls

- **Don't scope assertions to `result.container`.** The rendered marker is `display:none` and
  contains none of the UI; assert on the fixture host.
- **Reset the hash in `beforeEach`, not after.** Anchor clicks and `history.replaceState` mutate the
  iframe URL, and the next `init()` reads it.
- **Remove the fixture even when the assertion throws**, or a later test's `document.querySelectorAll`
  sees stale rows and duplicate matches.
- **Mirror the real DOM exactly.** `Glyph` emits `<use xlink:href="#rmx-glyph-<name>">` only; the
  settings toggle writes both `xlink:href` and plain `href`, and the glyph names the *action*
  (`eye` = show while hidden, `eyeOff` = hide once revealed).
- **Both engines run.** Keep assertions engine-neutral (no `networkidle`, no native `<select>`
  change assumptions — see `select-change-events.md`).

## When to Use

- Writing a `*.test.browser.tsx` for a full-page `clientEntry` (`app/ui/*.browser.tsx`,
  `app/actions/**/public/*.tsx`) that queries `document`/`window` and registers delegated listeners.
- Browser tests pass alone but fail together, or a test sees an unexpected active tab/panel.
- An entry writes the URL hash (`history.replaceState`, `href="#…"` anchors).

Related: `cliententry-browser-test-stubs.md` (geometry/media stubs),
`remix3-client-entries → references/aria-tabs.md` (production tabs pattern).
