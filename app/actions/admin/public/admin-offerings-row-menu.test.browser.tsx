import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { MenuSelectEvent } from '@remix-run/ui/menu'

import { AdminOfferingsRowMenu } from './admin-offerings-row-menu.tsx'

// Visible per-row kebab for /verwaltung/offerings. The right-click menu has its
// own coverage in admin-context-menus.test.browser.tsx; here we assert the
// discoverable trigger and that its configuration/delete items stay wired to
// the shared row helpers.

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []
let confirmResult = true
let confirmMessage = ''
let deleteSubmits = 0

function setup() {
  let host = document.createElement('div')
  host.innerHTML = `
    <form data-delete-form="5" action="/verwaltung/offerings/5"></form>
  `
  document.body.appendChild(host)
  fixture = host

  deleteSubmits = 0
  ;(host.querySelector('form[data-delete-form="5"]') as HTMLFormElement).addEventListener(
    'submit',
    (event) => {
      event.preventDefault()
      deleteSubmits++
    },
  )

  let result = render(
    <AdminOfferingsRowMenu rowId="5" resourceId="42" rowLabel="Angebot am 01.01.2026" />,
  )
  cleanups.push(result.cleanup)
  return { container: result.container, act: result.act }
}

function triggerOf(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('[data-offerings-row-menu-trigger="5"]') as HTMLButtonElement
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

describe('AdminOfferingsRowMenu', () => {
  it('renders a named kebab trigger and both secondary actions', () => {
    let { container } = setup()
    let trigger = triggerOf(container)

    assert.equal(trigger.getAttribute('aria-haspopup'), 'menu')
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    assert.ok(
      trigger.getAttribute('aria-label')?.includes('Weitere Aktionen'),
      'the trigger should have an accessible name',
    )
    assert.ok(
      container.textContent?.includes('Konfiguration'),
      'configuration should be in the menu',
    )
    assert.ok(container.textContent?.includes('Löschen'), 'delete should be in the menu')
  })

  it('opens the menu from the visible trigger', async (t) => {
    let { container, act } = setup()
    let trigger = triggerOf(container)

    await act(() => trigger.click())
    await t.waitFor(() => trigger.getAttribute('aria-expanded') === 'true')
  })

  it('deletes the row after confirmation', () => {
    let { container } = setup()

    selectItem(container, 'delete')

    assert.equal(confirmMessage, 'Wirklich löschen?')
    assert.equal(deleteSubmits, 1, 'the row delete form should be submitted')
  })

  it('does not delete when the confirmation is declined', () => {
    let { container } = setup()
    confirmResult = false

    selectItem(container, 'delete')

    assert.equal(confirmMessage, 'Wirklich löschen?')
    assert.equal(deleteSubmits, 0)
  })
})
