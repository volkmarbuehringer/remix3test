import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { MenuSelectEvent } from '@remix-run/ui/menu'

import { AdminUploadsContextMenu } from './admin-uploads-context-menu.tsx'
import { AdminUsersContextMenu } from './admin-users-context-menu.tsx'
import { AdminOfferingsContextMenu } from './admin-offerings-context-menu.tsx'
import { AdminAppointmentsContextMenu } from './admin-appointments-context-menu.tsx'
import { AdminResourcesContextMenu } from './admin-resources-context-menu.tsx'
import { AdminOfferingConfigsContextMenu } from './admin-offering-configs-context-menu.tsx'

// Right-click row menus. Each is driven the way the vendor runtime drives it:
// a contextmenu on the table captures the row id + positions the hidden trigger,
// and a bubbling MenuSelectEvent selects an item. The delete/edit navigation
// targets are left to their own e2e coverage; here we assert the capture and the
// confirm/delete wiring, which is shared by every menu.

interface MenuCase {
  label: string
  tableAttr: string
  deleteMessage: string
  rowAttrs?: string
  hasDownload?: boolean
  mount: () => ReturnType<typeof render>
}

const CASES: MenuCase[] = [
  {
    label: 'resources',
    tableAttr: 'data-resources-table',
    deleteMessage: 'Wirklich löschen?',
    mount: () => render(<AdminResourcesContextMenu />),
  },
  {
    label: 'offering configs',
    tableAttr: 'data-offering-configs-table',
    deleteMessage: 'Wirklich löschen?',
    mount: () => render(<AdminOfferingConfigsContextMenu />),
  },
  {
    label: 'offerings',
    tableAttr: 'data-offerings-table',
    deleteMessage: 'Wirklich löschen?',
    mount: () => render(<AdminOfferingsContextMenu />),
  },
  {
    label: 'appointments',
    tableAttr: 'data-appointments-table',
    deleteMessage: 'Wirklich löschen?',
    mount: () => render(<AdminAppointmentsContextMenu />),
  },
  {
    label: 'users',
    tableAttr: 'data-users-table',
    deleteMessage: 'Wirklich löschen?',
    mount: () => render(<AdminUsersContextMenu />),
  },
  {
    label: 'uploads',
    tableAttr: 'data-uploads-table',
    deleteMessage: 'Datei "file-1.txt" wirklich löschen?',
    rowAttrs: 'data-upload-filename="file-1.txt"',
    hasDownload: true,
    mount: () => render(<AdminUploadsContextMenu />),
  },
]

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []
let confirmResult = true
let confirmMessage = ''

function fixtureHtml(c: MenuCase): string {
  let rowAttrs = `data-row-id="5"${c.rowAttrs ? ' ' + c.rowAttrs : ''}`
  let link = c.hasDownload ? '<a data-download-link href="/admin/uploads/5">x</a>' : ''
  return `<div ${c.tableAttr}><div ${rowAttrs}><span>Row</span>${link}</div></div>
    <form data-delete-form="5" action="/delete/5"></form>`
}

interface Setup {
  host: HTMLElement
  container: HTMLElement
  submits: () => number
}

function setup(c: MenuCase): Setup {
  let host = document.createElement('div')
  host.innerHTML = fixtureHtml(c)
  document.body.appendChild(host)
  fixture = host

  let submitCount = 0
  let form = host.querySelector('form[data-delete-form="5"]') as HTMLFormElement
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitCount++
  })

  let result = c.mount()
  cleanups.push(result.cleanup)
  return { host, container: result.container, submits: () => submitCount }
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

describe('admin row context menus', () => {
  for (let c of CASES) {
    describe(c.label, () => {
      it('captures a right-clicked row and positions the menu trigger', () => {
        let { host, container } = setup(c)

        let event = rightClick(rowOf(host), 12, 34)

        assert.equal(event.defaultPrevented, true, 'the browser menu is suppressed')
        let trigger = positionedTrigger(container)
        assert.ok(trigger, 'the trigger should be positioned at the pointer')
        assert.equal(trigger!.style.left, '12px')
        assert.equal(trigger!.style.top, '34px')
      })

      it('ignores a right-click that misses every row', () => {
        let { host, container } = setup(c)
        let table = host.querySelector(`[${c.tableAttr}]`) as HTMLElement

        let event = rightClick(table, 5, 6)

        assert.equal(event.defaultPrevented, true)
        assert.equal(positionedTrigger(container), null, 'no row -> no trigger positioning')
      })

      it('deletes the captured row after confirmation', () => {
        let { host, container, submits } = setup(c)

        rightClick(rowOf(host))
        selectItem(container, 'delete')

        assert.equal(confirmMessage, c.deleteMessage)
        assert.equal(submits(), 1, 'the row delete form should be submitted')
      })

      it('does not delete when the confirmation is declined', () => {
        let { host, container, submits } = setup(c)
        confirmResult = false

        rightClick(rowOf(host))
        selectItem(container, 'delete')

        assert.equal(confirmMessage, c.deleteMessage)
        assert.equal(submits(), 0)
      })

      if (c.hasDownload) {
        it('clicks the row download link', () => {
          let { host, container } = setup(c)
          let link = host.querySelector('a[data-download-link]') as HTMLAnchorElement
          let clicks = 0
          link.addEventListener('click', (event) => {
            event.preventDefault()
            clicks++
          })

          rightClick(rowOf(host))
          selectItem(container, 'download')

          assert.equal(clicks, 1)
        })
      }
    })
  }
})
