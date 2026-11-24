import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ToastHost } from './toast-host.browser.tsx'
import { showToast } from './toast.ts'
import { APP_OVERLAY_ROOT_ID } from './overlay-root.tsx'

const FAKE_NOW = new Date('2026-11-11T12:00:00Z')

// Toasts are still an imperative `showToast()` API, but the shell's ToastHost
// owns the DOM now. These tests pin the host contract the client entries rely
// on: the shell overlay root destination, one shared viewport, call-order
// stacking, the theme-tone split, live-region roles, and auto-dismiss.

let result: ReturnType<typeof render> | null = null

function mountShellRoot(): HTMLElement {
  let root = document.createElement('div')
  root.id = APP_OVERLAY_ROOT_ID
  document.body.append(root)
  return root
}

function mountHost() {
  result = render(<ToastHost />)
  return result
}

function toastRoot(): HTMLElement | null {
  return document.getElementById('__toast-root')
}

afterEach(() => {
  result?.cleanup()
  result = null
  document.getElementById(APP_OVERLAY_ROOT_ID)?.remove()
  document.getElementById('__toast-root')?.remove()
})

describe('ToastHost', () => {
  it('portals stacked toasts into the shell overlay root', async () => {
    let shellRoot = mountShellRoot()
    let { act } = mountHost()

    await act(() => {
      showToast('Fehler beim Speichern.')
      showToast('Erfolg', 'success')
    })

    let container = toastRoot()
    assert.ok(container, 'the toast viewport should exist')
    assert.equal(container.parentElement, shellRoot, 'toasts live in the shell overlay root')
    assert.equal(document.querySelectorAll('#__toast-root').length, 1, 'the root is shared')
    assert.equal(container.children.length, 2, 'each message is its own toast')
    assert.equal(container.children[0]?.textContent, 'Fehler beim Speichern.')
    assert.equal(container.children[1]?.textContent, 'Erfolg')
    assert.equal(
      document.querySelectorAll('[data-toast-host-ready]').length,
      1,
      'the host marks itself ready only after attaching its listener',
    )
  })

  it('keeps the error/success theme tones and live-region roles', async (t) => {
    mountShellRoot()
    let rootElement = document.documentElement
    let themeVariables = [
      '--rmx-color-action-danger-background',
      '--rmx-color-action-danger-foreground',
      '--rmx-color-success-background',
      '--rmx-color-success-foreground',
    ]
    let previous = new Map(
      themeVariables.map((name) => [name, rootElement.style.getPropertyValue(name)]),
    )
    rootElement.style.setProperty('--rmx-color-action-danger-background', 'rgb(220, 38, 38)')
    rootElement.style.setProperty('--rmx-color-action-danger-foreground', 'rgb(255, 255, 255)')
    rootElement.style.setProperty('--rmx-color-success-background', 'rgb(220, 252, 231)')
    rootElement.style.setProperty('--rmx-color-success-foreground', 'rgb(22, 101, 52)')
    t.after(() => {
      for (let [name, value] of previous) rootElement.style.setProperty(name, value)
    })

    let { act } = mountHost()
    await act(() => {
      showToast('Fehler', 'error')
      showToast('Erfolg', 'success')
    })

    let [errorToast, successToast] = [...toastRoot()!.children] as HTMLElement[]
    assert.ok(errorToast, 'the error toast should render')
    assert.ok(successToast, 'the success toast should render')
    assert.equal(errorToast.dataset.toastType, 'error')
    assert.equal(successToast.dataset.toastType, 'success')
    assert.equal(errorToast.getAttribute('role'), 'alert')
    assert.equal(successToast.getAttribute('role'), 'status')

    let errorStyle = getComputedStyle(errorToast)
    let successStyle = getComputedStyle(successToast)
    assert.equal(errorStyle.backgroundColor, 'rgb(220, 38, 38)')
    assert.equal(successStyle.backgroundColor, 'rgb(220, 252, 231)')
    assert.notEqual(errorStyle.color, successStyle.color)
  })

  it('removes a toast after the display timeout', async (t) => {
    mountShellRoot()
    let timers = t.useFakeTimers({ now: FAKE_NOW })
    let { act } = mountHost()
    await act(() => showToast('Fehler beim Speichern.'))

    assert.equal(toastRoot()?.children.length, 1)
    await act(() => {
      timers.advance(3500)
    })
    assert.equal(toastRoot()?.children.length, 1, 'the toast stays while fading out')
    await act(() => {
      timers.advance(300)
    })
    assert.equal(toastRoot(), null, 'the viewport is removed with the last toast')
  })

  it('falls back to document.body without the shell root', async () => {
    let { act } = mountHost()
    await act(() => showToast('Ohne Shell'))

    let container = toastRoot()
    assert.ok(container, 'the toast viewport should exist')
    assert.equal(container.parentElement, document.body)
  })

  it('keeps only the newest three toasts when messages arrive in a burst', async () => {
    mountShellRoot()
    let { act } = mountHost()

    await act(() => {
      for (let index = 1; index <= 5; index++) showToast(`Meldung ${index}`)
    })

    let messages = [...toastRoot()!.children].map((toast) => toast.textContent)
    assert.equal(messages.length, 3, 'the stack is capped at three toasts')
    assert.deepEqual(messages, ['Meldung 3', 'Meldung 4', 'Meldung 5'])
  })

  it('keeps a long unbroken message inside the viewport', async () => {
    mountShellRoot()
    let { act } = mountHost()
    let message = 'A'.repeat(200)

    await act(() => showToast(message))

    let toast = toastRoot()!.firstElementChild as HTMLElement
    assert.equal(toast.textContent, message)
    let maxWidth = Math.min(448, window.innerWidth - 32)
    let rect = toast.getBoundingClientRect()
    assert.ok(
      rect.width <= maxWidth + 1,
      `the toast must not exceed ${maxWidth}px (rendered ${rect.width}px)`,
    )
    assert.ok(
      document.documentElement.scrollWidth <= window.innerWidth,
      'the long message must not create horizontal page overflow',
    )
  })

  it('does not intercept pointer input', async () => {
    mountShellRoot()
    let { act } = mountHost()

    await act(() => showToast('Klick geht durch'))

    let toast = toastRoot()!.firstElementChild as HTMLElement
    assert.equal(getComputedStyle(toast).pointerEvents, 'none')
    assert.equal(getComputedStyle(toastRoot()!).pointerEvents, 'none')
  })
})
