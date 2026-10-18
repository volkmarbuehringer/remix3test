import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsRowActions } from './lists-row-actions.tsx'

// The sidebar row menu is transient DOM state plus document-level dismissal
// listeners. The markup mirrors lists-layout.tsx (server-rendered); the style
// block mirrors the production contract that a closed menu is display: none,
// so its action buttons are inert and out of the sequential tab order.
const ROWS_HTML = `
  <style>
    [data-list-menu] { display: none; }
    [data-list-menu][data-list-menu-open] { display: grid; }
  </style>
  <div data-list-id="1">
    <a href="/lists?load=1" tabindex="0">
      <span data-list-name>Alpha</span>
      <span data-list-count>1/3</span>
    </a>
    <button type="button" draggable="false" data-list-menu-button aria-expanded="false" aria-controls="list-row-menu-1">⋯</button>
    <div id="list-row-menu-1" data-list-menu role="group" aria-label="Aktionen für Alpha" draggable="false">
      <button type="button" data-list-rename-btn draggable="false">Umbenennen</button>
      <form method="POST" action="/lists/1/copy"><button type="submit" data-list-copy-btn draggable="false">Duplizieren</button></form>
      <form method="POST" action="/lists/1/delete" data-confirm="&quot;Alpha&quot; löschen?"><button type="submit" data-list-delete-btn draggable="false">Löschen</button></form>
    </div>
  </div>
  <div data-list-id="2">
    <a href="/lists?load=2" tabindex="-1">
      <span data-list-name>Beta</span>
      <span data-list-count>0/2</span>
    </a>
    <button type="button" draggable="false" data-list-menu-button aria-expanded="false" aria-controls="list-row-menu-2">⋯</button>
    <div id="list-row-menu-2" data-list-menu role="group" aria-label="Aktionen für Beta" draggable="false">
      <button type="button" data-list-rename-btn draggable="false">Umbenennen</button>
      <form method="POST" action="/lists/2/copy"><button type="submit" data-list-copy-btn draggable="false">Duplizieren</button></form>
      <form method="POST" action="/lists/2/delete" data-confirm="&quot;Beta&quot; löschen?"><button type="submit" data-list-delete-btn draggable="false">Löschen</button></form>
    </div>
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

function triggerOf(host: HTMLElement, id: string): HTMLButtonElement {
  return rowOf(host, id).querySelector('[data-list-menu-button]') as HTMLButtonElement
}

function menuOf(host: HTMLElement, id: string): HTMLElement {
  return rowOf(host, id).querySelector('[data-list-menu]') as HTMLElement
}

function menuButton(host: HTMLElement, id: string, text: string): HTMLButtonElement {
  let button = [...menuOf(host, id).querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  )
  assert.ok(button, `the menu must offer "${text}"`)
  return button
}

function countOf(host: HTMLElement, id: string): HTMLElement {
  return rowOf(host, id).querySelector('[data-list-count]') as HTMLElement
}

function pointerDown(target: Element) {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

function settle(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function mountEntry() {
  let result = render(<ListsRowActions />)
  cleanup = result.cleanup
  return result
}

async function openMenu(host: HTMLElement, id: string) {
  await Promise.resolve()
  triggerOf(host, id).click()
  await settle()
  assert.equal(menuOf(host, id).hasAttribute('data-list-menu-open'), true, 'the menu must open')
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('sidebar row action menu', () => {
  it('opens one row menu at a time and focuses its first action', async () => {
    let host = mountRows()
    mountEntry()

    await openMenu(host, '1')

    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'true')
    assert.equal(document.activeElement, menuButton(host, '1', 'Umbenennen'))

    triggerOf(host, '2').click()
    await settle()

    assert.equal(menuOf(host, '1').hasAttribute('data-list-menu-open'), false)
    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'false')
    assert.equal(menuOf(host, '2').hasAttribute('data-list-menu-open'), true)
    assert.equal(triggerOf(host, '2').getAttribute('aria-expanded'), 'true')
    assert.equal(document.activeElement, menuButton(host, '2', 'Umbenennen'))
  })

  it('closes on an outside pointerdown', async () => {
    let host = mountRows()
    mountEntry()
    await openMenu(host, '1')

    await Promise.resolve()
    pointerDown(document.body)
    await settle()

    assert.equal(menuOf(host, '1').hasAttribute('data-list-menu-open'), false)
    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'false')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    let host = mountRows()
    mountEntry()
    await openMenu(host, '1')

    pressEscape()
    await settle()

    assert.equal(menuOf(host, '1').hasAttribute('data-list-menu-open'), false)
    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'false')
    assert.equal(
      document.activeElement,
      triggerOf(host, '1'),
      'Escape must return focus to the row trigger',
    )
  })

  it('toggles closed when its trigger is activated again', async () => {
    let host = mountRows()
    mountEntry()
    await openMenu(host, '1')

    triggerOf(host, '1').click()
    await settle()

    assert.equal(menuOf(host, '1').hasAttribute('data-list-menu-open'), false)
    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'false')
  })

  it('keeps closed menu actions out of the tab order', async () => {
    let host = mountRows()
    mountEntry()

    assert.equal(menuOf(host, '1').offsetParent, null, 'a closed menu must not be rendered')
    assert.equal(countOf(host, '1').textContent, '1/3', 'the count badge stays visible')

    triggerOf(host, '1').focus()
    menuButton(host, '1', 'Löschen').focus()
    assert.equal(
      document.activeElement,
      triggerOf(host, '1'),
      'an action inside a closed menu must not accept focus',
    )

    await openMenu(host, '1')
    assert.notEqual(menuOf(host, '1').offsetParent, null, 'an open menu is rendered')
    menuButton(host, '1', 'Löschen').focus()
    assert.equal(document.activeElement, menuButton(host, '1', 'Löschen'))
  })

  it('closes after choosing an action and returns focus to the trigger', async () => {
    let host = mountRows()
    let result = mountEntry()
    await openMenu(host, '1')

    await result.act(() => menuButton(host, '1', 'Umbenennen').click())
    await result.act(() => settle(20))

    assert.equal(menuOf(host, '1').hasAttribute('data-list-menu-open'), false)
    assert.equal(triggerOf(host, '1').getAttribute('aria-expanded'), 'false')
    assert.equal(
      document.activeElement,
      triggerOf(host, '1'),
      'focus must not fall back to <body> after an action',
    )
  })
})
