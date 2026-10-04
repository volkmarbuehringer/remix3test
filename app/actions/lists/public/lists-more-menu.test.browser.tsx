import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'

// The "Weitere Aktionen" menu is a native <details>; ListsClient adds the
// dismissal behavior (outside pointerdown, inner button click, Escape + focus
// return). The wiring is prop-independent and document-scoped, so a fixture menu
// is enough — no list state needed. Extracted from lists-client-ops.test.e2e.ts.

const FIXTURE_HTML = `
  <details data-lists-more>
    <summary aria-label="Weitere Aktionen">⋯</summary>
    <button type="button">Auswahl löschen</button>
  </details>
  <h2 id="menu-outside">Titel</h2>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = FIXTURE_HTML
  document.body.appendChild(host)
  fixture = host
  return host
}

function menuOf(host: HTMLElement): HTMLDetailsElement {
  return host.querySelector('details[data-lists-more]') as HTMLDetailsElement
}
function summaryOf(host: HTMLElement): HTMLElement {
  return menuOf(host).querySelector('summary') as HTMLElement
}

function mountEntry() {
  cleanup = render(<ListsClient initialState={null} />).cleanup
}

function pointerDown(target: Element) {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('lists more menu dismissal', () => {
  it('closes an open menu on Escape and returns focus to the summary', () => {
    let host = mount()
    mountEntry()
    let menu = menuOf(host)
    menu.open = true

    pressEscape()

    assert.equal(menu.open, false)
    assert.equal(document.activeElement, summaryOf(host))
  })

  it('closes an open menu on an outside pointerdown', () => {
    let host = mount()
    mountEntry()
    let menu = menuOf(host)
    menu.open = true

    pointerDown(host.querySelector('#menu-outside') as HTMLElement)

    assert.equal(menu.open, false)
  })

  it('leaves the menu open when its own summary is pressed', () => {
    let host = mount()
    mountEntry()
    let menu = menuOf(host)
    menu.open = true

    pointerDown(summaryOf(host))

    assert.equal(menu.open, true, 'the native toggle must be allowed to run')
  })

  it('closes the menu when one of its buttons is clicked', () => {
    let host = mount()
    mountEntry()
    let menu = menuOf(host)
    menu.open = true

    menuOf(host)
      .querySelector('button')
      ?.dispatchEvent(new Event('click', { bubbles: true }))

    assert.equal(menu.open, false)
  })

  it('is a no-op on Escape when no menu is open', () => {
    let host = mount()
    mountEntry()
    let menu = menuOf(host)

    pressEscape()

    assert.equal(menu.open, false)
  })
})
