import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { UploadDropzone } from './admin-uploads-dropzone.tsx'
import { theme } from '../../../ui/theme/theme.ts'

// Client-interaction half of the dropzone suite. The frame-reload persistence
// cases (selection survives a Frame DOM replacement) stay in
// uploads-dropzone.test.e2e.ts; everything here needs no server.

const FORM_HTML = `
  <form data-upload-form action="/admin/uploads" method="POST" enctype="multipart/form-data">
    <input type="file" name="file" multiple data-file-input />
    <div data-dropzone>
      <label for="file-input">Dateien hierher ziehen</label>
    </div>
    <ul data-pending-list hidden></ul>
    <p data-upload-validation hidden></p>
    <button type="submit" data-upload-submit disabled>
      <span data-upload-idle>Hochladen</span>
      <span data-upload-busy hidden>Hochladen…</span>
    </button>
  </form>
  <h1>Übersicht</h1>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html = FORM_HTML): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function formOf(host: HTMLElement): HTMLFormElement {
  return host.querySelector('[data-upload-form]') as HTMLFormElement
}
function inputOf(host: HTMLElement): HTMLInputElement {
  return host.querySelector('[data-file-input]') as HTMLInputElement
}
function dropzoneOf(host: HTMLElement): HTMLElement {
  return host.querySelector('[data-dropzone]') as HTMLElement
}
function listOf(host: HTMLElement): HTMLUListElement {
  return host.querySelector('[data-pending-list]') as HTMLUListElement
}
function submitOf(host: HTMLElement): HTMLButtonElement {
  return host.querySelector('[data-upload-submit]') as HTMLButtonElement
}
function validationOf(host: HTMLElement): HTMLElement {
  return host.querySelector('[data-upload-validation]') as HTMLElement
}
function outsideOf(host: HTMLElement): HTMLElement {
  return host.querySelector('h1') as HTMLElement
}

function mountEntry() {
  cleanup = render(<UploadDropzone />).cleanup
}

function filesTransfer(files: File[]): DataTransfer {
  let dt = new DataTransfer()
  for (let file of files) dt.items.add(file)
  return dt
}

function textTransfer(text: string): DataTransfer {
  let dt = new DataTransfer()
  dt.setData('text/plain', text)
  return dt
}

function dragEvent(type: string, dataTransfer: DataTransfer): DragEvent {
  return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
}

afterEach(() => {
  // `pendingFiles` is module-scoped so a selection survives a Frame replacement.
  // In this test file it would leak into the next test, so clear it the only way
  // the entry does: submit the selected batch.
  let form = fixture?.querySelector('[data-upload-form]') as HTMLFormElement | null
  let input = fixture?.querySelector('[data-file-input]') as HTMLInputElement | null
  if (form && input && (input.files?.length ?? 0) > 0) {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('UploadDropzone', () => {
  it('marks the form ready and starts with an empty pending list', () => {
    let host = mount()
    mountEntry()

    assert.equal(formOf(host).dataset.dropzoneReady, 'true')
    assert.equal(listOf(host).hasAttribute('hidden'), true)
    assert.equal(submitOf(host).disabled, true)
  })

  it('opens the file picker once when the dropzone box is clicked', () => {
    let host = mount()
    mountEntry()
    let input = inputOf(host)
    let clicks = 0
    input.click = () => {
      clicks++
    }

    let event = new MouseEvent('click', { bubbles: true, cancelable: true })
    dropzoneOf(host).dispatchEvent(event)

    assert.equal(event.defaultPrevented, true, 'the box click must be intercepted')
    assert.equal(clicks, 1, 'exactly one picker open per box click')
  })

  it('leaves clicks on the label to the native path', () => {
    let host = mount()
    mountEntry()
    let input = inputOf(host)
    let clicks = 0
    input.click = () => {
      clicks++
    }

    let label = dropzoneOf(host).querySelector('label') as HTMLLabelElement
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    assert.equal(clicks, 0, 'the label must not be double-opened by the entry')
  })

  it('turns a dropped file into a pending chip, fills the input, and enables submit', () => {
    let host = mount()
    mountEntry()
    let file = new File(['hello'], 'dropped-inside.txt', { type: 'text/plain' })

    let zone = dropzoneOf(host)
    zone.dispatchEvent(dragEvent('dragover', filesTransfer([file])))
    assert.equal(zone.dataset.dragover, 'true', 'dragover marks the active drop target')

    zone.dispatchEvent(dragEvent('drop', filesTransfer([file])))

    assert.equal(zone.dataset.dragover, undefined, 'drop clears the dragover marker')
    assert.equal(listOf(host).hasAttribute('hidden'), false)
    let items = listOf(host).querySelectorAll('li')
    assert.equal(items.length, 1)
    assert.equal(items[0]?.querySelector('span')?.textContent, 'dropped-inside.txt')
    assert.equal(
      items[0]?.querySelector('button')?.getAttribute('aria-label'),
      'dropped-inside.txt entfernen',
    )
    assert.equal(items[0]?.getAttribute('data-pending-file'), '5')
    assert.equal(inputOf(host).files?.length, 1, 'the dropped file lands in the hidden input')
    assert.equal(submitOf(host).disabled, false)
  })

  it('styles the chip from the theme tokens without double-wrapping', () => {
    let host = mount()
    mountEntry()
    let file = new File(['hello'], 'dropped-inside.txt', { type: 'text/plain' })

    dropzoneOf(host).dispatchEvent(dragEvent('drop', filesTransfer([file])))

    let style = listOf(host).querySelector('li')?.getAttribute('style') ?? ''
    assert.ok(style.includes(theme.surface.lvl3), `chip background should be ${theme.surface.lvl3}`)
    assert.ok(
      style.includes(theme.colors.border.default),
      `chip border should use ${theme.colors.border.default}`,
    )
  })

  it('removes a pending chip and disables submit again', () => {
    let host = mount()
    mountEntry()
    let file = new File(['hello'], 'dropped-inside.txt', { type: 'text/plain' })
    dropzoneOf(host).dispatchEvent(dragEvent('drop', filesTransfer([file])))

    let remove = listOf(host).querySelector('li button') as HTMLButtonElement
    remove.click()

    assert.equal(listOf(host).querySelectorAll('li').length, 0)
    assert.equal(listOf(host).hasAttribute('hidden'), true)
    assert.equal(inputOf(host).files?.length, 0)
    assert.equal(submitOf(host).disabled, true)
  })

  it('cancels a file dropped outside the dropzone and explains where to drop it', () => {
    let host = mount()
    mountEntry()
    let file = new File(['x'], 'dropped-outside.txt', { type: 'text/plain' })
    let outside = outsideOf(host)

    let dragover = dragEvent('dragover', filesTransfer([file]))
    outside.dispatchEvent(dragover)
    let drop = dragEvent('drop', filesTransfer([file]))
    outside.dispatchEvent(drop)

    assert.equal(dragover.defaultPrevented, true)
    assert.equal(drop.defaultPrevented, true)
    assert.equal(validationOf(host).hasAttribute('hidden'), false)
    assert.equal(validationOf(host).textContent, 'Bitte Dateien in das Feld oben ziehen.')
    assert.equal(inputOf(host).files?.length, 0, 'a stray drop must not select anything')
  })

  it('passes a fileless drag through to the browser', () => {
    let host = mount()
    mountEntry()
    let outside = outsideOf(host)

    let dragover = dragEvent('dragover', textTransfer('dragged text'))
    outside.dispatchEvent(dragover)
    let drop = dragEvent('drop', textTransfer('dragged text'))
    outside.dispatchEvent(drop)

    assert.equal(dragover.defaultPrevented, false)
    assert.equal(drop.defaultPrevented, false)
  })

  it('blocks an empty submit with a validation message', () => {
    let host = mount()
    mountEntry()
    let form = formOf(host)

    let event = new Event('submit', { bubbles: true, cancelable: true })
    let notCancelled = form.dispatchEvent(event)

    assert.equal(notCancelled, false, 'the empty submit must be prevented')
    assert.equal(validationOf(host).hasAttribute('hidden'), false)
    assert.equal(validationOf(host).textContent, 'Keine Dateien ausgewählt.')
    assert.equal(submitOf(host).disabled, true)
  })
})
