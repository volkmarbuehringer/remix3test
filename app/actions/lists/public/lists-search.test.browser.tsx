import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsSearch } from './lists-search.tsx'

// Frame-independent DOM behavior of ListsSearch. The form GET / frame reload
// itself needs a real frame and stays in the e2e suite; here we assert the
// enhancement drives the already server-rendered GET form.

const FORM =
  '<form data-lists-search="true"><input id="lists-sidebar-search" type="search" name="filter" /></form>'

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

function countSubmits(input: HTMLInputElement): () => number {
  let submits = 0
  input.closest('form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    submits++
  })
  return () => submits
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ListsSearch', () => {
  it('refocuses the input on mount when it already has content', () => {
    mount(FORM.replace('name="filter"', 'name="filter" value="abc"'))
    renderEntry()

    assert.equal(searchInput().value, 'abc')
    assert.equal(document.activeElement, searchInput())
  })

  it('clears the filter and resubmits on Escape', () => {
    mount(FORM)
    renderEntry()

    let input = searchInput()
    input.value = 'abc'
    let submits = countSubmits(input)
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    assert.equal(event.defaultPrevented, true, 'Escape is handled by the entry')
    assert.equal(input.value, '')
    assert.equal(submits(), 1, 'Escape resubmits the cleared filter')
  })

  it('ignores Escape when the filter is already empty', () => {
    mount(FORM)
    renderEntry()

    let input = searchInput()
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    assert.equal(event.defaultPrevented, false, 'nothing to clear, nothing to intercept')
  })

  it('debounces typing into a single form submit', async () => {
    mount(FORM)
    renderEntry()

    let input = searchInput()
    let submits = countSubmits(input)
    input.value = 'abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    input.value = 'abcd'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))

    assert.equal(submits(), 0, 'the submit waits for the debounce')
    await new Promise((resolve) => setTimeout(resolve, 500))
    assert.equal(submits(), 1, 'the last value is submitted once')
  })
})
