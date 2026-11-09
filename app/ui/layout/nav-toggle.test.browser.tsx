import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { NavToggle } from './nav-toggle.browser.tsx'

// ---------------------------------------------------------------------------
// NavToggle drawer behaviour in a real browser.
//
// The drawer is a native <dialog>: showModal() supplies the top layer, inert
// background, Escape (cancel), focus containment, and native focus restore.
// This entry adds the page scroll lock and aria-expanded. The tests mount the
// real server-rendered nav markup as a document-body fixture and drive real
// click/platform events; assertions target the DOM facts the entry mutates.
// ---------------------------------------------------------------------------

// Mirrors main-nav.tsx.
const NAV_HTML = `
  <button id="nav-toggle" type="button" aria-controls="nav-drawer" aria-expanded="false">☰</button>
  <dialog id="nav-drawer" aria-label="Navigation">
    <button id="nav-close" type="button" aria-label="Menü schließen">✕</button>
    <a href="#">Link</a>
  </dialog>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null
let result: RenderResult | null = null
let mounted: { btn: HTMLElement; drawer: HTMLDialogElement } | null = null

function mount(): { btn: HTMLElement; drawer: HTMLDialogElement; closeBtn: HTMLElement } {
  let host = document.createElement('div')
  host.innerHTML = NAV_HTML
  document.body.appendChild(host)
  fixture = host
  let refs = {
    btn: host.querySelector('#nav-toggle') as HTMLElement,
    drawer: host.querySelector('#nav-drawer') as HTMLDialogElement,
    closeBtn: host.querySelector('#nav-close') as HTMLElement,
  }
  mounted = refs
  return refs
}

function renderEntry() {
  result = render(<NavToggle />)
  cleanup = result.cleanup
}

/**
 * Re-render the mounted entry in place, the way a layout re-render does.
 */
function rerenderEntry() {
  result!.root.render(<NavToggle />)
  result!.root.flush()
}

/**
 * The platform queues the `close` event. Poll instead of assuming it arrives
 * in the next macrotask — under a loaded browser suite it can land later.
 */
async function waitForScrollUnlock(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (document.documentElement.style.overflow === '') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.fail('scroll lock did not release after the drawer closed')
}

afterEach(() => {
  // lockScroll refcounts on a document-keyed WeakMap. If an assertion left the
  // drawer open, close it through the entry so the unlock runs before the
  // fixture is removed; otherwise a stale count corrupts the next test's lock.
  if (mounted?.drawer.open) mounted.btn.click()
  mounted = null
  cleanup?.()
  cleanup = null
  result = null
  fixture?.remove()
  fixture = null
})

describe('NavToggle (real browser)', () => {
  it('opens on toggle click: native modal, aria-expanded, and locked scroll', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()

    assert.equal(drawer.open, true, 'showModal should open the native dialog')
    assert.equal(drawer.matches(':modal'), true, 'the dialog should be in the top layer')
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

    assert.equal(drawer.open, false, 'dialog should close')
    assert.equal(btn.getAttribute('aria-expanded'), 'false', 'aria-expanded reflects closed state')
    assert.equal(document.documentElement.style.overflow, '', 'scroll should be unlocked')
    assert.equal(
      document.activeElement,
      btn,
      'focus should restore to the previously focused toggle',
    )
  })

  it('releases the scroll lock through the platform close path (Escape/cancel)', async () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    assert.equal(drawer.open, true, 'sanity: open before close')

    // Escape reaches a modal <dialog> as `cancel`, whose default action closes
    // it. Calling close() here is the same platform path the browser uses.
    drawer.close()

    await waitForScrollUnlock()

    assert.equal(drawer.open, false, 'the platform closed the dialog')
    assert.equal(btn.getAttribute('aria-expanded'), 'false', 'aria-expanded should be reset')
    assert.equal(document.activeElement, btn, 'focus should return to the trigger')
  })

  it('closes on a click on the drawer surface and unlocks scroll', () => {
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    assert.equal(drawer.open, true, 'sanity: open before surface click')

    drawer.click()

    assert.equal(drawer.open, false, 'a drawer click should close the dialog')
    assert.equal(document.documentElement.style.overflow, '', 'scroll should be unlocked')
  })

  it('does nothing when the drawer markup is absent', () => {
    // The entry bails when getElementById finds nothing — no throw on pages
    // without the drawer.
    renderEntry()
    assert.equal(document.documentElement.style.overflow, '', 'no lock without a drawer')
  })

  it('releases the scroll lock when the open drawer element is replaced', () => {
    // A layout re-render can swap the drawer element while the entry keeps
    // running. The replacement dialog is closed, so the reference-counted
    // scroll lock must not stay held, or the page cannot scroll again until a
    // full reload.
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()
    assert.equal(
      document.documentElement.style.overflow,
      'hidden',
      'sanity: scroll is locked while the drawer is open',
    )

    let replacement = document.createElement('dialog')
    replacement.id = 'nav-drawer'
    drawer.replaceWith(replacement)
    mounted = { btn, drawer: replacement }

    rerenderEntry()

    assert.equal(
      document.documentElement.style.overflow,
      '',
      'the scroll lock must be released when the drawer is replaced',
    )
  })

  it('restores focus to the current toggle when the original trigger was replaced', () => {
    // The trigger that opened the drawer can be replaced by a re-render.
    // Focusing the detached original is a no-op, which drops focus to
    // <body> and breaks the focus order (WCAG 2.4.3).
    let { btn, drawer } = mount()
    renderEntry()

    btn.focus()
    btn.click()

    let replacement = document.createElement('button')
    replacement.id = 'nav-toggle'
    btn.replaceWith(replacement)
    mounted = { btn: replacement, drawer }

    rerenderEntry()

    // Close the drawer through the replacement trigger.
    replacement.click()

    assert.equal(
      document.activeElement,
      replacement,
      'focus should land on the toggle that is in the document',
    )
  })
})
