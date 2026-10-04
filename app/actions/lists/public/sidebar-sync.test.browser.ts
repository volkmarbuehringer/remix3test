import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { syncSidebarRow } from './sidebar-sync.ts'

const ROW_HTML = `
  <div data-list-id="7" data-updated-at="100">
    <a href="/lists?load=7" title="Alt">
      <span data-list-name>Alt</span>
    </a>
    <form data-confirm='"Alt" löschen?'>
      <button type="button" aria-label='Liste "Alt" löschen'>×</button>
    </form>
    <span data-list-count aria-label="1/3 erledigt">1/3</span>
  </div>
`

let fixture: HTMLElement | null = null

function mountRows(html: string): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function rowOf(host: HTMLElement, id: string): HTMLElement {
  return host.querySelector(`[data-list-id="${id}"]`) as HTMLElement
}

afterEach(() => {
  fixture?.remove()
  fixture = null
})

describe('syncSidebarRow', () => {
  it('updates the name, link title, delete confirm, badge and updated-at in place', () => {
    let host = mountRows(ROW_HTML)

    syncSidebarRow(7, { label: 'Neu', untitled: true, count: 5, doneCount: 2, updatedAt: 999 })

    let row = rowOf(host, '7')
    assert.equal(row.querySelector('[data-list-name]')?.textContent, 'Neu')
    assert.equal(row.querySelector('a[href]')?.getAttribute('title'), 'Neu')
    assert.equal(
      row.querySelector('form[data-confirm]')?.getAttribute('data-confirm'),
      '"Neu" löschen?',
    )
    assert.equal(
      row.querySelector('button[aria-label]')?.getAttribute('aria-label'),
      'Liste "Neu" löschen',
    )
    assert.equal(row.querySelector('[data-list-count]')?.textContent, '2/5')
    assert.equal(
      row.querySelector('[data-list-count]')?.getAttribute('aria-label'),
      '2 von 5 erledigt',
    )
    assert.equal(row.getAttribute('data-updated-at'), '999')
    assert.ok(row.hasAttribute('data-list-untitled'), 'untitled marker should be set')
  })

  it('clears the untitled marker once the list has a title', () => {
    let host = mountRows(ROW_HTML)
    let row = rowOf(host, '7')
    row.setAttribute('data-list-untitled', '')

    syncSidebarRow(7, { label: 'Einkaufsliste', untitled: false })

    assert.equal(row.querySelector('[data-list-name]')?.textContent, 'Einkaufsliste')
    assert.ok(!row.hasAttribute('data-list-untitled'), 'untitled marker should be removed')
  })

  it('leaves fields untouched when only the label is synced', () => {
    let host = mountRows(ROW_HTML)

    syncSidebarRow(7, { label: 'Neu' })

    let row = rowOf(host, '7')
    assert.equal(row.querySelector('[data-list-name]')?.textContent, 'Neu')
    assert.equal(row.querySelector('[data-list-count]')?.textContent, '1/3')
    assert.equal(row.getAttribute('data-updated-at'), '100')
  })

  it('is a no-op for an id with no matching row', () => {
    let host = mountRows(ROW_HTML)

    syncSidebarRow(999, { label: 'X', untitled: true, count: 9, doneCount: 9, updatedAt: 1 })

    let row = rowOf(host, '7')
    assert.equal(row.querySelector('[data-list-name]')?.textContent, 'Alt')
    assert.equal(row.querySelector('[data-list-count]')?.textContent, '1/3')
    assert.equal(row.getAttribute('data-updated-at'), '100')
    assert.equal(row.hasAttribute('data-list-untitled'), false)
  })

  it('picks the matching row that actually carries a name element', () => {
    let host = mountRows(`
      <div data-list-id="7"><span>stale shell without a name</span></div>
      <div data-list-id="7"><span data-list-name>Alt</span></div>
    `)

    syncSidebarRow(7, { label: 'Neu' })

    let rows = host.querySelectorAll('[data-list-id="7"]')
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.querySelector('[data-list-name]'), null)
    assert.equal(rows[1]?.querySelector('[data-list-name]')?.textContent, 'Neu')
  })
})
