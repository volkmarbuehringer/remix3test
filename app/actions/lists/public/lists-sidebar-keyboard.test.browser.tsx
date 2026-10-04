import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsSidebarKeyboard } from './lists-sidebar-keyboard.tsx'

const ROWS_HTML = `
  <div data-list-id="1" tabindex="0">
    <a href="/lists?load=1"><span data-list-name>Alpha</span></a>
    <button type="button" data-list-rename-btn>Umbenennen</button>
  </div>
  <div data-list-id="2" tabindex="0">
    <a href="/lists?load=2"><span data-list-name>Beta</span></a>
    <button type="button" data-list-rename-btn>Umbenennen</button>
  </div>
  <div data-list-id="3" tabindex="0">
    <a href="/lists?load=3"><span data-list-name>Gamma</span></a>
    <button type="button" data-list-rename-btn>Umbenennen</button>
  </div>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mountRows(html = ROWS_HTML): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function rowOf(host: HTMLElement, id: string): HTMLElement {
  return host.querySelector(`[data-list-id="${id}"]`) as HTMLElement
}

function linkOf(host: HTMLElement, id: string): HTMLAnchorElement {
  return rowOf(host, id).querySelector('a[href]') as HTMLAnchorElement
}

function mountEntry() {
  cleanup = render(<ListsSidebarKeyboard />).cleanup
}

function press(target: Element, key: string): boolean {
  return target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  )
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ListsSidebarKeyboard', () => {
  it('installs a single roving tab stop on the row anchors', () => {
    let host = mountRows()
    mountEntry()

    assert.equal(linkOf(host, '1').getAttribute('tabindex'), '0')
    assert.equal(linkOf(host, '2').getAttribute('tabindex'), '-1')
    assert.equal(linkOf(host, '3').getAttribute('tabindex'), '-1')
    // The wrapper's tabindex is dropped so it cannot add a second tab stop.
    assert.equal(rowOf(host, '1').getAttribute('tabindex'), null)
    assert.equal(rowOf(host, '2').getAttribute('tabindex'), null)
    assert.equal(rowOf(host, '3').getAttribute('tabindex'), null)
  })

  it('moves focus and the tab stop with ArrowDown and ArrowUp', () => {
    let host = mountRows()
    mountEntry()

    let notCancelled = press(linkOf(host, '1'), 'ArrowDown')

    assert.equal(notCancelled, false, 'ArrowDown should be handled (preventDefault)')
    assert.equal(document.activeElement, linkOf(host, '2'))
    assert.equal(linkOf(host, '2').getAttribute('tabindex'), '0')
    assert.equal(linkOf(host, '1').getAttribute('tabindex'), '-1')

    press(linkOf(host, '2'), 'ArrowUp')

    assert.equal(document.activeElement, linkOf(host, '1'))
    assert.equal(linkOf(host, '1').getAttribute('tabindex'), '0')
    assert.equal(linkOf(host, '2').getAttribute('tabindex'), '-1')
  })

  it('clamps ArrowUp at the first row and ArrowDown at the last', () => {
    let host = mountRows()
    mountEntry()

    press(linkOf(host, '1'), 'ArrowUp')
    assert.equal(document.activeElement, linkOf(host, '1'))

    press(linkOf(host, '1'), 'End')
    press(linkOf(host, '3'), 'ArrowDown')
    assert.equal(document.activeElement, linkOf(host, '3'))
  })

  it('jumps to the first and last row with Home and End', () => {
    let host = mountRows()
    mountEntry()

    press(linkOf(host, '1'), 'End')
    assert.equal(document.activeElement, linkOf(host, '3'))
    assert.equal(linkOf(host, '3').getAttribute('tabindex'), '0')
    assert.equal(linkOf(host, '1').getAttribute('tabindex'), '-1')

    press(linkOf(host, '3'), 'Home')
    assert.equal(document.activeElement, linkOf(host, '1'))
  })

  it('typeahead focuses the next label starting with the typed character', () => {
    let host = mountRows()
    mountEntry()

    press(linkOf(host, '1'), 'g')

    assert.equal(document.activeElement, linkOf(host, '3'))
    assert.equal(linkOf(host, '3').getAttribute('tabindex'), '0')
  })

  it('ignores rows whose data-list-id is not numeric', () => {
    let host = mountRows(`
      <div data-list-id="1"><a href="/lists?load=1"><span data-list-name>Alpha</span></a></div>
      <div data-list-id="abc"><a href="/lists?load=abc"><span data-list-name>Broken</span></a></div>
    `)
    mountEntry()

    assert.equal(linkOf(host, '1').getAttribute('tabindex'), '0')
    assert.equal(
      host.querySelector('[data-list-id="abc"] a[href]')?.getAttribute('tabindex'),
      null,
      'non-numeric rows stay out of the roving set',
    )
  })

  it('leaves nested row controls to handle their own key events', () => {
    let host = mountRows()
    mountEntry()

    linkOf(host, '1').focus()
    assert.equal(document.activeElement, linkOf(host, '1'))

    let renameBtn = rowOf(host, '1').querySelector('button') as HTMLButtonElement
    press(renameBtn, 'ArrowDown')

    assert.equal(document.activeElement, linkOf(host, '1'), 'focus should stay on the link')
  })
})
