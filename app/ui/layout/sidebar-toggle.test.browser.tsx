import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { SidebarToggle } from './sidebar-toggle.browser.tsx'

// ---------------------------------------------------------------------------
// SidebarToggle — the phone-only "Bereiche" drawer.
//
// The entry registers its listeners with handle.signal, so each per-test
// render is fully removed at cleanup. The click half (toggle open/close,
// destination-collapses, aria-expanded sync) is driven with a real document
// fixture below. The breakpoint reset (matchMedia change → collapse) is not
// exercised here: a render() test cannot resize the Playwright viewport to
// fire a genuine MediaQueryList change, and dispatching a synthetic change on
// the entry's internal MediaQueryList handle is not reachable.
// ---------------------------------------------------------------------------

const SHELL_HTML = `
  <button id="sidebar-shell-toggle" type="button" aria-expanded="false">Bereiche</button>
  <nav id="sidebar-shell-nav">
    <a id="nav-dest" href="#">Uploads</a>
  </nav>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(): void {
  let host = document.createElement('div')
  host.innerHTML = SHELL_HTML
  document.body.appendChild(host)
  fixture = host
}

function renderEntry() {
  cleanup = render(<SidebarToggle />).cleanup
}

function toggle(): HTMLElement {
  return document.getElementById('sidebar-shell-toggle') as HTMLElement
}
function sidebar(): HTMLElement {
  return document.getElementById('sidebar-shell-nav') as HTMLElement
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('SidebarToggle', () => {
  it('opens the drawer on the toggle button and marks aria-expanded', () => {
    mount()
    renderEntry()

    toggle().click()

    assert.ok(sidebar().classList.contains('is-open'), 'drawer gains is-open')
    assert.equal(toggle().getAttribute('aria-expanded'), 'true')
  })

  it('closes again on a second toggle click', () => {
    mount()
    renderEntry()

    let btn = toggle()
    btn.click()
    assert.ok(sidebar().classList.contains('is-open'), 'sanity: open')

    btn.click()

    assert.ok(!sidebar().classList.contains('is-open'), 'drawer loses is-open')
    assert.equal(btn.getAttribute('aria-expanded'), 'false')
  })

  it('collapses the open drawer when a destination inside it is chosen', () => {
    mount()
    renderEntry()

    toggle().click()
    assert.ok(sidebar().classList.contains('is-open'), 'sanity: open')

    let dest = document.getElementById('nav-dest') as HTMLElement
    dest.addEventListener('click', (e) => e.preventDefault()) // no navigation
    dest.click()

    assert.ok(!sidebar().classList.contains('is-open'), 'choosing a destination closes the drawer')
    assert.equal(
      toggle().getAttribute('aria-expanded'),
      'false',
      'the toggle stays in sync when the drawer self-collapses',
    )
  })

  it('leaves the drawer closed when a destination is clicked while it is closed', () => {
    mount()
    renderEntry()

    let dest = document.getElementById('nav-dest') as HTMLElement
    dest.addEventListener('click', (e) => e.preventDefault())
    dest.click()

    assert.ok(!sidebar().classList.contains('is-open'), 'a closed drawer stays closed')
    assert.equal(toggle().getAttribute('aria-expanded'), 'false')
  })

  it('does nothing when the shell markup is absent', () => {
    renderEntry()
    let stray = document.createElement('button')
    stray.id = 'sidebar-shell-toggle'
    document.body.appendChild(stray)

    stray.click() // no #sidebar-shell-nav present → listener bails early
    stray.remove()

    assert.ok(!document.querySelector('.is-open'), 'no drawer element, no open state')
  })
})
