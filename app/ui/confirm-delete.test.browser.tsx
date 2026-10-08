import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ConfirmDelete, requestConfirm } from './confirm-delete.browser.tsx'

// ---------------------------------------------------------------------------
// ConfirmDelete — the arm-the-confirm interception on destructive submits.
//
// The entry registers a capture-phase click listener on document (scoped to
// handle.signal, so per-test renders are safe) and opens an in-app dialog.
// Nothing submits until the dialog's confirm button is clicked; cancelling must
// leave the form untouched. Every page that links a row-delete form to this
// entry relies on it.
// ---------------------------------------------------------------------------

let fixture: HTMLElement | null = null
let result: ReturnType<typeof render> | null = null
let submitted: string[] = []

function mountForm(attrs: string): { form: HTMLFormElement; btn: HTMLButtonElement } {
  let host = document.createElement('div')
  host.innerHTML =
    '<form ' +
    attrs +
    ' action="#" method="post">' +
    '<button type="submit" data-del>Löschen</button>' +
    '<button type="button" data-plain>Nur UI</button>' +
    '<input type="hidden" name="id" value="7" />' +
    '</form>'
  document.body.appendChild(host)
  fixture = host
  let form = host.querySelector('form') as HTMLFormElement
  form.addEventListener('submit', (event) => {
    event.preventDefault() // never actually navigate
    submitted.push(form.getAttribute('data-confirm') ?? '<no-confirm>')
  })
  return {
    form,
    btn: host.querySelector<HTMLButtonElement>('[data-del]')!,
  }
}

function mountEntry() {
  result = render(<ConfirmDelete />)
}

function dialog(): HTMLElement | null {
  return result!.container.querySelector<HTMLElement>('[data-confirm-dialog]')
}

afterEach(() => {
  result?.cleanup()
  result = null
  fixture?.remove()
  fixture = null
  submitted = []
})

describe('ConfirmDelete', () => {
  it('opens a styled dialog instead of submitting immediately', async () => {
    let { btn } = mountForm('data-confirm="Wirklich löschen?"')
    mountEntry()

    await result!.act(() => btn.click())

    assert.ok(dialog(), 'a dialog should be rendered')
    assert.ok(
      dialog()!.textContent?.includes('Wirklich löschen?'),
      'the dialog shows the form-specific message',
    )
    assert.deepEqual(submitted, [], 'nothing submits while the dialog is open')
  })

  it('submits once when the dialog is confirmed', async () => {
    let { btn } = mountForm('data-confirm="Wirklich löschen?"')
    mountEntry()
    await result!.act(() => btn.click())

    let accept = dialog()!.querySelector<HTMLButtonElement>('[data-confirm-accept]')!
    await result!.act(() => accept.click())

    assert.equal(dialog(), null, 'the dialog closes on confirm')
    assert.deepEqual(submitted, ['Wirklich löschen?'], 'the form submits exactly once')
  })

  it('does not submit when the dialog is cancelled', async () => {
    let { btn } = mountForm('data-confirm="Wirklich löschen?"')
    mountEntry()
    await result!.act(() => btn.click())

    let cancel = dialog()!.querySelector<HTMLButtonElement>('[data-confirm-cancel]')!
    await result!.act(() => cancel.click())

    assert.equal(dialog(), null, 'the dialog closes on cancel')
    assert.deepEqual(submitted, [], 'a cancelled confirm must not submit the form')
  })

  it('falls back to the default message for an empty data-confirm', async () => {
    let { btn } = mountForm('data-confirm=""')
    mountEntry()

    await result!.act(() => btn.click())

    assert.ok(dialog()!.textContent?.includes('Wirklich löschen?'))
    assert.deepEqual(submitted, [])
  })

  it('does not intercept forms without data-confirm', () => {
    let { btn } = mountForm('')
    mountEntry()

    btn.click()

    assert.equal(dialog(), null, 'no dialog for plain forms')
    assert.deepEqual(submitted, ['<no-confirm>'], 'plain form submits unimpeded')
  })

  it('ignores non-submit buttons', () => {
    let host = document.createElement('div')
    host.innerHTML =
      '<form data-confirm="Nein" action="#" method="post">' +
      '<button type="button" data-x>UI</button>' +
      '</form>'
    document.body.appendChild(host)
    fixture = host
    mountEntry()

    host.querySelector<HTMLButtonElement>('[data-x]')!.click()

    assert.equal(dialog(), null, 'type=button never asks')
  })

  it('handles an imperative requestConfirm and runs the callback on accept', async () => {
    mountEntry()
    let ran = 0
    let handled = requestConfirm({
      message: 'Aus dem Menü löschen?',
      onConfirm: () => {
        ran++
      },
    })
    assert.equal(handled, true, 'a mounted dialog takes over the request')

    await result!.act(() => undefined)
    assert.ok(dialog()!.textContent?.includes('Aus dem Menü löschen?'))

    let accept = dialog()!.querySelector<HTMLButtonElement>('[data-confirm-accept]')!
    await result!.act(() => accept.click())
    assert.equal(ran, 1, 'the callback runs once on accept')
  })

  it('does not run an imperative requestConfirm callback on cancel', async () => {
    mountEntry()
    let ran = 0
    requestConfirm({
      message: 'Nicht ausführen?',
      onConfirm: () => {
        ran++
      },
    })
    await result!.act(() => undefined)

    let cancel = dialog()!.querySelector<HTMLButtonElement>('[data-confirm-cancel]')!
    await result!.act(() => cancel.click())
    assert.equal(ran, 0, 'the callback must not run when cancelled')
  })
})
