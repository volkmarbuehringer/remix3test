import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsSearch } from './lists-search.tsx'

// Frame-independent DOM behavior of ListsSearch. The URL the search builds is
// covered by lists-search-url.test.ts; the debounced navigation itself needs a
// real frame and stays in the e2e suite.

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html: string): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function searchInput(): HTMLInputElement {
  return document.getElementById('lists-sidebar-search') as HTMLInputElement
}

function renderEntry() {
  cleanup = render(<ListsSearch />).cleanup
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ListsSearch', () => {
  it('refocuses the input on mount when it already has content', () => {
    mount('<input id="lists-sidebar-search" value="abc" />')
    renderEntry()

    assert.equal(searchInput().value, 'abc')
    assert.equal(document.activeElement, searchInput())
  })

  it('clears the filter on Escape', () => {
    mount('<input id="lists-sidebar-search" />')
    renderEntry()

    let input = searchInput()
    input.value = 'abc'
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    assert.equal(event.defaultPrevented, true, 'Escape is handled by the entry')
    assert.equal(input.value, '')
    // The entry's focus-return runs after doSearch(), which navigates the frame;
    // a component-test root cannot resolve that navigation, so only the effects
    // before it are asserted here.
  })

  it('ignores Escape when the filter is already empty', () => {
    mount('<input id="lists-sidebar-search" />')
    renderEntry()

    let input = searchInput()
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    assert.equal(event.defaultPrevented, false, 'nothing to clear, nothing to intercept')
  })
})
