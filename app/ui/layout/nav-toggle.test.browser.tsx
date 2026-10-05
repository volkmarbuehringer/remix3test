import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { NavToggle } from './nav-toggle.browser.tsx'

// ---------------------------------------------------------------------------
// NavToggle drawer behaviour in a real browser.
//
// Replaces the previous server test, which hand-rolled a fake `document` and
// mocked getElementById/classList/setAttribute/focus so it could observe the
// entry's own bookkeeping. The entry only works against real DOM anyway —
// classList.toggle, focus()/activeElement, and lockScroll (documentElement
// overflow + scrollTo) — so we mount the real server-rendered nav markup as a
// document-body fixture (document-scoped clientEntry pattern) and drive real
// click/keydown events. Every mock disappears; the assertions target the DOM
// facts the entry actually mutates.
// ---------------------------------------------------------------------------

// Mirrors main-nav.tsx: the closed drawer is translated off-screen by CSS
// (`is-open` toggles it), never `hidden` — so #nav-close stays focusable, which
// is what the entry relies on when it moves focus on open.
const NAV_HTML = `
  <button id="nav-toggle" type="button" aria-controls="nav-drawer" aria-expanded="false">☰</button>
  <div id="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
    <button id="nav-close" type="button" aria-label="Menü schließen">✕</button>
    <a href="#">Link</a>
  </div>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null
let mounted: { btn: HTMLElement; drawer: HTMLElement } | null = null

function mount(): { btn: HTMLElement; drawer: HTMLElement; closeBtn: HTMLElement } {
  let host = document.createElement('div')
  host.innerHTML = NAV_HTML
  document.body.appendChild(host)
  fixture = host
  let refs = {
    btn: host.querySelector('#nav-toggle') as HTMLElement,
    drawer: host.querySelector('#nav-drawer') as HTMLElement,
    closeBtn: host.querySelector('#nav-close') as HTMLElement,
  }
  mounted = refs
  return refs
}

function renderEntry() {
  cleanup = render(<NavToggle />).cleanup
}

afterEach(() => {
  // lockScroll refcounts on a document-keyed WeakMap and its listeners live on
  // the fixture nodes. If an assertion left the drawer open, close it first so
  // the unlock runs (restores overflow + deletes the WeakMap entry) before the
  // fixture is removed; otherwise a stale count corrupts the next test's lock.
  if (mounted && mounted.drawer.classList.contains('is-open')) mounted.btn.click()
  mounted = null
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('NavToggle (real browser)', () => {
  it('opens on toggle click: is-open class, aria-expanded, and locked scroll', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()

    assert.ok(drawer.classList.contains('is-open'), 'drawer should gain is-open')
    assert.equal(btn.getAttribute('aria-expanded'), 'true', 'aria-expanded reflects open state')
    assert.equal(
      document.documentElement.style.overflow,
      'hidden',
      'body scroll should be locked while the drawer is open',
    )
  })

  it('moves focus to the close button on open', () => {
    let { btn, closeBtn } = mount()
    renderEntry()

    btn.focus()
    btn.click()

    assert.equal(document.activeElement, closeBtn, 'focus should move to #nav-close when opening')
  })

  it('closes on second toggle click: restores focus and unlocks scroll', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    btn.click()

    assert.ok(!drawer.classList.contains('is-open'), 'drawer should lose is-open on close')
    assert.equal(btn.getAttribute('aria-expanded'), 'false', 'aria-expanded reflects closed state')
    assert.equal(document.documentElement.style.overflow, '', 'scroll should be unlocked')
    assert.equal(
      document.activeElement,
      btn,
      'focus should restore to the previously focused toggle',
    )
  })

  it('closes on Escape keydown in the drawer', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    assert.ok(drawer.classList.contains('is-open'), 'sanity: open before Escape')

    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    assert.ok(!drawer.classList.contains('is-open'), 'Escape should close the drawer')
  })

  it('ignores a non-Escape key', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()

    drawer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    assert.ok(drawer.classList.contains('is-open'), 'Enter should not close the drawer')
  })

  it('closes on a backdrop click in the drawer', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    assert.ok(drawer.classList.contains('is-open'), 'sanity: open before backdrop click')

    drawer.click()

    assert.ok(!drawer.classList.contains('is-open'), 'a drawer click should close the drawer')
  })

  it('does nothing when the drawer markup is absent', () => {
    // The entry bails when getElementById finds nothing — no throw on pages
    // without the drawer.
    renderEntry()
    assert.equal(document.documentElement.style.overflow, '', 'no lock without a drawer')
  })
})
