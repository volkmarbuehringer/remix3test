import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsRowActions } from './lists-row-actions.tsx'

const ROWS_HTML = `
  <div data-list-id="1">
    <span data-list-count>1/3</span>
    <button type="button" data-list-row-action>Löschen</button>
  </div>
  <div data-list-id="2">
    <span data-list-count>0/2</span>
    <button type="button" data-list-row-action>Kopieren</button>
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

function actionOf(host: HTMLElement, id: string): HTMLElement {
  return rowOf(host, id).querySelector('[data-list-row-action]') as HTMLElement
}

function countOf(host: HTMLElement, id: string): HTMLElement {
  return rowOf(host, id).querySelector('[data-list-count]') as HTMLElement
}

function mountEntry() {
  cleanup = render(<ListsRowActions />).cleanup
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ListsRowActions', () => {
  it('reveals a row action cluster on hover and hides its count badge', () => {
    let host = mountRows()
    mountEntry()

    rowOf(host, '1').dispatchEvent(new MouseEvent('mouseenter'))

    assert.equal(actionOf(host, '1').style.opacity, '1')
    assert.equal(actionOf(host, '1').style.pointerEvents, 'auto')
    assert.equal(countOf(host, '1').style.opacity, '0')
  })

  it('only reveals the hovered row', () => {
    let host = mountRows()
    mountEntry()

    rowOf(host, '1').dispatchEvent(new MouseEvent('mouseenter'))

    assert.notEqual(actionOf(host, '2').style.opacity, '1')
    assert.notEqual(countOf(host, '2').style.opacity, '0')
  })

  it('dims the actions again on mouseleave and restores the count badge', () => {
    let host = mountRows()
    mountEntry()

    rowOf(host, '1').dispatchEvent(new MouseEvent('mouseenter'))
    rowOf(host, '1').dispatchEvent(new MouseEvent('mouseleave'))

    assert.equal(actionOf(host, '1').style.opacity, '')
    assert.equal(actionOf(host, '1').style.pointerEvents, '')
    assert.equal(countOf(host, '1').style.opacity, '')
  })

  it('reveals on keyboard focus entering the row', () => {
    let host = mountRows()
    mountEntry()

    actionOf(host, '1').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

    assert.equal(actionOf(host, '1').style.opacity, '1')
    assert.equal(countOf(host, '1').style.opacity, '0')
  })

  it('dims when focus leaves the row', () => {
    let host = mountRows()
    mountEntry()

    actionOf(host, '1').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    actionOf(host, '1').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    )

    assert.equal(actionOf(host, '1').style.opacity, '')
    assert.equal(countOf(host, '1').style.opacity, '')
  })

  it('keeps the actions visible while focus moves within the same row', () => {
    let host = mountRows()
    mountEntry()

    actionOf(host, '1').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    actionOf(host, '1').dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: countOf(host, '1') }),
    )

    assert.equal(actionOf(host, '1').style.opacity, '1')
    assert.equal(countOf(host, '1').style.opacity, '0')
  })

  it('renders without any rows', () => {
    cleanup = render(<ListsRowActions />).cleanup
    assert.ok(true)
  })
})
