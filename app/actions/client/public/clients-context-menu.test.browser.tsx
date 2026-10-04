import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { MenuSelectEvent } from '@remix-run/ui/menu'

import { ClientsContextMenu } from './clients-context-menu.tsx'

// Client-grid row menu. Same right-click harness as the admin menus, plus the
// status-dependent Activate/Deactivate item (the entry re-renders on right-click
// from the row's data-status, so the right-click is wrapped in act()).

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []
let confirmResult = true
let confirmMessage = ''
let deleteSubmits = 0
let toggleSubmits = 0

function setup(status = 'Pending') {
  let host = document.createElement('div')
  host.innerHTML = `
    <div data-clients-table>
      <div data-row-id="5" data-status="${status}"><span>Row</span></div>
    </div>
    <form data-delete-form="5" action="/admin/clients/5/delete"></form>
    <form data-toggle-form="5" action="/admin/clients/5/toggle"></form>
  `
  document.body.appendChild(host)
  fixture = host

  deleteSubmits = 0
  toggleSubmits = 0
  ;(host.querySelector('form[data-delete-form="5"]') as HTMLFormElement).addEventListener(
    'submit',
    (event) => {
      event.preventDefault()
      deleteSubmits++
    },
  )
  ;(host.querySelector('form[data-toggle-form="5"]') as HTMLFormElement).addEventListener(
    'submit',
    (event) => {
      event.preventDefault()
      toggleSubmits++
    },
  )

  let result = render(<ClientsContextMenu />)
  cleanups.push(result.cleanup)
  return { host, container: result.container, act: result.act }
}

function rightClick(target: Element, clientX = 12, clientY = 34): MouseEvent {
  let event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  })
  target.dispatchEvent(event)
  return event
}

function rowOf(host: HTMLElement): HTMLElement {
  return host.querySelector('[data-row-id="5"]') as HTMLElement
}

function positionedTrigger(container: HTMLElement): HTMLElement | null {
  return (
    [...container.querySelectorAll<HTMLElement>('*')].find(
      (el) => el.style.left !== '' && el.style.top !== '',
    ) ?? null
  )
}

function selectItem(container: HTMLElement, name: string) {
  let menuList = container.querySelector('[role="menu"]')
  assert.ok(menuList, 'the menu list should render')
  menuList!.dispatchEvent(
    new MenuSelectEvent({ id: name, label: name, name, type: 'item', value: null }),
  )
}

beforeEach(() => {
  confirmResult = true
  confirmMessage = ''
  window.confirm = ((message?: string) => {
    confirmMessage = message ?? ''
    return confirmResult
  }) as typeof window.confirm
})

afterEach(() => {
  window.confirm = originalConfirm
  for (let cleanup of cleanups) cleanup()
  cleanups = []
  fixture?.remove()
  fixture = null
})

describe('ClientsContextMenu', () => {
  it('captures a right-clicked row and positions the menu trigger', async () => {
    let { host, container, act } = setup()
    let event: MouseEvent | undefined

    await act(() => {
      event = rightClick(rowOf(host), 12, 34)
    })

    assert.equal(event!.defaultPrevented, true, 'the browser menu is suppressed')
    let trigger = positionedTrigger(container)
    assert.ok(trigger, 'the trigger should be positioned at the pointer')
    assert.equal(trigger!.style.left, '12px')
    assert.equal(trigger!.style.top, '34px')
  })

  it('ignores a right-click that misses every row', () => {
    let { host, container } = setup()
    let table = host.querySelector('[data-clients-table]') as HTMLElement

    let event = rightClick(table, 5, 6)

    assert.equal(event.defaultPrevented, true)
    assert.equal(positionedTrigger(container), null, 'no row -> no trigger positioning')
  })

  it('offers Aktivieren for a non-active row and submits the toggle form', async () => {
    let { host, container, act } = setup('Pending')

    await act(() => {
      rightClick(rowOf(host))
    })

    assert.ok(container.textContent?.includes('Aktivieren'))
    assert.ok(!container.textContent?.includes('Deaktivieren'))

    selectItem(container, 'activate')
    assert.equal(toggleSubmits, 1)
  })

  it('offers Deaktivieren for an active row and submits the toggle form', async () => {
    let { host, container, act } = setup('Active')

    await act(() => {
      rightClick(rowOf(host))
    })

    assert.ok(container.textContent?.includes('Deaktivieren'))
    assert.ok(!container.textContent?.includes('Aktivieren'))

    selectItem(container, 'deactivate')
    assert.equal(toggleSubmits, 1)
  })

  it('deletes the captured row after confirmation', async () => {
    let { host, container, act } = setup()

    await act(() => {
      rightClick(rowOf(host))
    })
    selectItem(container, 'delete')

    assert.equal(confirmMessage, 'Wirklich löschen?')
    assert.equal(deleteSubmits, 1)
  })

  it('does not delete when the confirmation is declined', async () => {
    let { host, container, act } = setup()
    confirmResult = false

    await act(() => {
      rightClick(rowOf(host))
    })
    selectItem(container, 'delete')

    assert.equal(deleteSubmits, 0)
  })
})
