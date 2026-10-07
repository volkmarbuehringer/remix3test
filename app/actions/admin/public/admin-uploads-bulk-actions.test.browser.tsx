import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { UploadBulkDelete } from './admin-uploads-bulk-delete.tsx'
import { UploadBulkDownload } from './admin-uploads-bulk-download.tsx'
import { clearSelection, isSelected, selectedCount } from '../../../utils/upload-selection.ts'

// Client-assertion half of the uploads bulk actions. The in-frame PRG, banner and
// row-deletion flow stay in uploads-bulk-delete.test.e2e.ts; the id store itself
// is unit-tested in app/utils/upload-selection.test.ts. Both entries are mounted
// together because in production they wire the same checkboxes and share the store.

const TABLE_HTML = `
  <div data-uploads-table data-selection-scope="browser-test">
    <input type="checkbox" data-select-all />
    <input type="checkbox" name="ids" value="1" />
    <input type="checkbox" name="ids" value="2" />
    <input type="checkbox" name="ids" value="3" />
    <form data-delete-form="2" action="/admin/uploads/2/delete" method="POST"></form>
  </div>
  <form data-bulk-delete-form action="/admin/uploads/delete-many" method="POST">
    <span data-selected-count>0 ausgewählt</span>
    <button type="submit" disabled>Löschen</button>
  </form>
  <button data-clear-selection hidden>Auswahl aufheben</button>
  <form data-bulk-download-form action="/admin/uploads/download-many" method="POST" data-rmx-document>
    <button type="submit" disabled>Download</button>
  </form>
`

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []

function mount(html = TABLE_HTML): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function mountEntries() {
  cleanups.push(render(<UploadBulkDelete />).cleanup)
  cleanups.push(render(<UploadBulkDownload />).cleanup)
}

function deleteFormOf(host: HTMLElement): HTMLFormElement {
  return host.querySelector('[data-bulk-delete-form]') as HTMLFormElement
}
function downloadFormOf(host: HTMLElement): HTMLFormElement {
  return host.querySelector('[data-bulk-download-form]') as HTMLFormElement
}
function rowCb(host: HTMLElement, id: string): HTMLInputElement {
  return host.querySelector(`input[name="ids"][value="${id}"]`) as HTMLInputElement
}
function rowCbs(host: HTMLElement): HTMLInputElement[] {
  return Array.from(host.querySelectorAll('input[name="ids"]'))
}
function selectAllOf(host: HTMLElement): HTMLInputElement {
  return host.querySelector('[data-select-all]') as HTMLInputElement
}
function countOf(host: HTMLElement): HTMLElement {
  return host.querySelector('[data-selected-count]') as HTMLElement
}
function deleteSubmitOf(host: HTMLElement): HTMLButtonElement {
  return deleteFormOf(host).querySelector('button[type="submit"]') as HTMLButtonElement
}
function downloadSubmitOf(host: HTMLElement): HTMLButtonElement {
  return downloadFormOf(host).querySelector('button[type="submit"]') as HTMLButtonElement
}
function clearBtnOf(host: HTMLElement): HTMLButtonElement {
  return host.querySelector('[data-clear-selection]') as HTMLButtonElement
}

function change(target: HTMLInputElement, checked: boolean) {
  target.checked = checked
  target.dispatchEvent(new Event('change', { bubbles: true }))
}

function submit(form: HTMLFormElement): boolean {
  return form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

beforeEach(() => {
  clearSelection()
})

afterEach(() => {
  window.confirm = originalConfirm
  for (let c of cleanups) c()
  cleanups = []
  fixture?.remove()
  fixture = null
})

describe('uploads bulk actions', () => {
  it('marks both bulk forms ready and starts disabled with an empty selection', () => {
    let host = mount()
    mountEntries()

    assert.equal(deleteFormOf(host).dataset.bulkDeleteReady, 'true')
    assert.equal(downloadFormOf(host).dataset.bulkDownloadReady, 'true')
    assert.equal(deleteSubmitOf(host).disabled, true)
    assert.equal(downloadSubmitOf(host).disabled, true)
    assert.equal(countOf(host).textContent, '0 ausgewählt')
    assert.equal(clearBtnOf(host).hidden, true)
  })

  it('enables both bulk buttons and updates the count when a row is checked', () => {
    let host = mount()
    mountEntries()

    change(rowCb(host, '1'), true)

    assert.equal(countOf(host).textContent, '1 ausgewählt')
    assert.equal(deleteSubmitOf(host).disabled, false)
    assert.equal(downloadSubmitOf(host).disabled, false)
    assert.equal(clearBtnOf(host).hidden, false)

    change(rowCb(host, '1'), false)

    assert.equal(countOf(host).textContent, '0 ausgewählt')
    assert.equal(deleteSubmitOf(host).disabled, true)
    assert.equal(downloadSubmitOf(host).disabled, true)
  })

  it('selects every visible row with the header checkbox', () => {
    let host = mount()
    mountEntries()

    change(selectAllOf(host), true)

    assert.ok(rowCbs(host).every((cb) => cb.checked))
    assert.equal(countOf(host).textContent, '3 ausgewählt')
  })

  it('shows a partial selection as indeterminate on the header checkbox', () => {
    let host = mount()
    mountEntries()

    change(rowCb(host, '1'), true)

    assert.equal(selectAllOf(host).checked, false)
    assert.equal(selectAllOf(host).indeterminate, true)
  })

  it('clears rows, count and buttons with the clear control', () => {
    let host = mount()
    mountEntries()
    change(rowCb(host, '1'), true)

    clearBtnOf(host).click()

    assert.ok(rowCbs(host).every((cb) => !cb.checked))
    assert.equal(selectAllOf(host).checked, false)
    assert.equal(countOf(host).textContent, '0 ausgewählt')
    assert.equal(deleteSubmitOf(host).disabled, true)
    assert.equal(clearBtnOf(host).hidden, true)
  })

  it('blocks the bulk delete submit when nothing is selected', () => {
    let host = mount()
    mountEntries()
    let asked = false
    window.confirm = () => {
      asked = true
      return true
    }

    let notCancelled = submit(deleteFormOf(host))

    assert.equal(notCancelled, false, 'an empty bulk delete must be prevented')
    assert.equal(asked, false, 'no confirmation should be shown for an empty selection')
  })

  it('injects the selected ids on an accepted bulk delete and clears the store', () => {
    let host = mount()
    mountEntries()
    change(rowCb(host, '1'), true)
    change(rowCb(host, '2'), true)
    let asked = ''
    window.confirm = (message?: string) => {
      asked = message ?? ''
      return true
    }

    let notCancelled = submit(deleteFormOf(host))

    assert.equal(notCancelled, true, 'an accepted confirmation must let the submit through')
    assert.equal(asked, '2 Dateien wirklich löschen?')
    let hidden = deleteFormOf(host).querySelectorAll('input[data-bulk-delete-id]')
    assert.deepEqual([...hidden].map((el) => (el as HTMLInputElement).value).toSorted(), ['1', '2'])
    assert.equal(selectedCount(), 0, 'submitted rows leave the selection store')
  })

  it('cancels the bulk delete without injecting ids when the confirmation is declined', () => {
    let host = mount()
    mountEntries()
    change(rowCb(host, '1'), true)
    window.confirm = () => false

    let notCancelled = submit(deleteFormOf(host))

    assert.equal(notCancelled, false)
    assert.equal(deleteFormOf(host).querySelectorAll('input[data-bulk-delete-id]').length, 0)
    assert.equal(selectedCount(), 1, 'a declined submit keeps the selection')
  })

  it('injects the selected ids into the bulk download form on submit', () => {
    let host = mount()
    mountEntries()
    change(rowCb(host, '3'), true)

    let notCancelled = submit(downloadFormOf(host))

    assert.equal(notCancelled, true)
    let hidden = downloadFormOf(host).querySelectorAll('input[data-bulk-download-id]')
    assert.equal(hidden.length, 1)
    assert.equal((hidden[0] as HTMLInputElement).value, '3')
  })

  it('drops a row from the store when its own delete form is submitted', () => {
    let host = mount()
    mountEntries()
    change(rowCb(host, '2'), true)
    assert.equal(isSelected(2), true)

    submit(host.querySelector('form[data-delete-form="2"]') as HTMLFormElement)

    assert.equal(isSelected(2), false)
    assert.equal(selectedCount(), 0)
  })
})
