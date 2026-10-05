import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ConfirmDelete } from './confirm-delete.browser.tsx'

// ---------------------------------------------------------------------------
// ConfirmDelete — the arm-the-confirm interception on destructive submits.
//
// The entry registers a capture-phase click listener on document (scoped to
// handle.signal, so per-test renders are safe). A submit inside
// form[data-confirm] only proceeds when window.confirm answers yes; a "no"
// must preventDefault the click and stop the form from submitting. Every page
// that links a row-delete form to this entry relies on it — the destructive
// controls the ad-hoc-verification note forbids exercising on the dev server
// are now proven here instead.
// ---------------------------------------------------------------------------

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null
let confirmMessages: string[] = []
let submitted: string[] = []

function stubConfirm(answer: boolean) {
  confirmMessages = []
  window.confirm = ((message?: string) => {
    confirmMessages.push(message ?? '')
    return answer
  }) as typeof window.confirm
}

function mountForm(attrs: string): { form: HTMLFormElement; btn: HTMLButtonElement } {
  let host = document.createElement('div')
  host.innerHTML = `
    <form ${attrs} action="#" method="post">
      <button type="submit" data-del>Löschen</button>
      <button type="button" data-plain>Nur UI</button>
      <input type="hidden" name="id" value="7" />
    </form>
  `
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
  cleanup = render(<ConfirmDelete />).cleanup
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  window.confirm = originalConfirm
  submitted = []
})

describe('ConfirmDelete', () => {
  it('blocks the submit when the confirmation is declined', () => {
    let { btn } = mountForm('data-confirm="Wirklich löschen?"')
    mountEntry()
    stubConfirm(false)

    btn.click()

    assert.deepEqual(confirmMessages, ['Wirklich löschen?'])
    assert.deepEqual(submitted, [], 'a declined confirm must not submit the form')
  })

  it('lets the submit through when the confirmation is accepted', () => {
    let { btn } = mountForm('data-confirm="Wirklich löschen?"')
    mountEntry()
    stubConfirm(true)

    btn.click()

    assert.equal(confirmMessages.length, 1)
    assert.deepEqual(submitted, ['Wirklich löschen?'], 'accepted confirm submits once')
  })

  it('asks with the form-specific message', () => {
    let { btn } = mountForm('data-confirm="Eigenen Text"')
    mountEntry()
    stubConfirm(false)

    btn.click()

    assert.deepEqual(confirmMessages, ['Eigenen Text'])
    assert.deepEqual(submitted, [])
  })

  it('falls back to the default message for an empty data-confirm', () => {
    let { btn } = mountForm('data-confirm=""')
    mountEntry()
    stubConfirm(false)

    btn.click()

    assert.deepEqual(confirmMessages, ['Wirklich löschen?'])
  })

  it('does not intercept forms without data-confirm', () => {
    let { btn } = mountForm('')
    mountEntry()
    stubConfirm(true)

    btn.click()

    assert.deepEqual(confirmMessages, [], 'no dialog for plain forms')
    assert.deepEqual(submitted, ['<no-confirm>'], 'plain form submits unimpeded')
  })

  it('ignores non-submit buttons', () => {
    let host = document.createElement('div')
    host.innerHTML = `
      <form data-confirm="Nein" action="#" method="post">
        <button type="button" data-x>UI</button>
      </form>
    `
    document.body.appendChild(host)
    fixture = host
    mountEntry()
    stubConfirm(true)

    host.querySelector<HTMLButtonElement>('[data-x]')!.click()

    assert.deepEqual(confirmMessages, [], 'type=button never asks')
  })
})
