import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { showToast } from './toast.ts'

const FAKE_NOW = new Date('2026-11-11T12:00:00Z')

// The app keeps its own imperative toast (see the remix3-ui
// first-party-ui-blocks delta for the vendor comparison). These tests pin the
// contract the two clientEntries rely on: one shared root, append-order
// stacking, the theme-tone split between error and success, and auto-dismiss.
// They are the baseline a future @remix-run/ui/toast migration must preserve.

function root(): HTMLElement | null {
  return document.getElementById('__toast-root')
}

afterEach(() => {
  root()?.remove()
})

describe('showToast', () => {
  it('reuses one root and stacks messages in call order', (t) => {
    t.useFakeTimers({ now: FAKE_NOW })
    showToast('Fehler beim Speichern.')
    showToast('Erfolg', 'success')

    let container = root()
    assert.ok(container, 'the toast root should exist')
    assert.equal(document.querySelectorAll('#__toast-root').length, 1, 'the root is shared')
    assert.equal(container.children.length, 2, 'each message is its own toast')
    assert.equal(container.children[0]?.textContent, 'Fehler beim Speichern.')
    assert.equal(container.children[1]?.textContent, 'Erfolg')
  })

  it('styles error and success toasts with different theme tones', (t) => {
    t.useFakeTimers({ now: FAKE_NOW })
    showToast('Fehler', 'error')
    showToast('Erfolg', 'success')

    let [errorToast, successToast] = [...root()!.children] as HTMLElement[]
    assert.equal(errorToast?.textContent, 'Fehler')
    assert.ok(errorToast?.style.backgroundColor, 'an error toast should set a background')
    assert.ok(errorToast?.style.color, 'an error toast should set a text colour')
    assert.notEqual(errorToast?.style.backgroundColor, successToast?.style.backgroundColor)
    assert.notEqual(errorToast?.style.color, successToast?.style.color)
  })

  it('removes a toast after the display timeout', (t) => {
    let timers = t.useFakeTimers({ now: FAKE_NOW })
    showToast('Fehler beim Speichern.')
    let container = root()!
    assert.equal(container.children.length, 1)

    timers.advance(3500)
    assert.equal(container.children.length, 1, 'the toast stays while fading out')
    timers.advance(300)
    assert.equal(container.children.length, 0, 'the toast is removed after the timeout')
  })
})
