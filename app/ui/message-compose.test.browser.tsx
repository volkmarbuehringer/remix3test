import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle } from 'remix/component'

import { MessageCompose } from './message-compose.browser.tsx'

// ---------------------------------------------------------------------------
// MessageCompose — draft persistence, char counter, sanitization warning.
//
// The compose textarea, counter, and strip warning are component-owned DOM:
// the entry server-renders them and hydrates with a `ref` on the textarea, so
// the draft/counter wiring (and the draft-clearing form listeners) follow the
// element's signal. Tests mount a form fixture and render the entry into an
// inner mount so cleanup() removes only the component, not the form.
// sessionStorage is the store, so every case starts and ends with the draft
// key cleared.
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'admin-messages-compose-draft'

let fixture: HTMLFormElement | null = null
let mount: HTMLElement | null = null
let cleanup: (() => void) | null = null
let submitCount = 0
let testFrame: EventTarget | null = null

/** Captures the test root's frame so a case can close the pending window. */
function FrameProbe(handle: Handle) {
  testFrame = handle.frame
  return () => null
}

function mountForm(): void {
  let host = document.createElement('form')
  host.id = 'messages-compose-form'
  host.setAttribute('action', '#')
  host.setAttribute('method', 'post')
  host.innerHTML = `<button type="submit">Senden</button>`
  mount = document.createElement('div')
  host.appendChild(mount)
  document.body.appendChild(host)
  fixture = host
  host.addEventListener('submit', (e) => {
    e.preventDefault()
    submitCount++
  })
}

async function renderEntry(): Promise<RenderResult> {
  let result = render(
    <>
      <MessageCompose maxLength={1000} strippableWarning />
      <FrameProbe />
    </>,
    { container: mount! },
  )
  cleanup = result.cleanup
  await result.act(() => undefined) // flush the initial commit / ref binding
  return result
}

function textarea(): HTMLTextAreaElement {
  return document.getElementById('messages-content') as HTMLTextAreaElement
}

function typeBody(value: string): void {
  let field = textarea()
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function counter(): HTMLElement {
  return document.querySelector('[data-compose-counter]') as HTMLElement
}

function warning(): HTMLElement {
  return document.querySelector('[data-compose-warning]') as HTMLElement
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  mount = null
  submitCount = 0
  testFrame = null
  sessionStorage.removeItem(DRAFT_KEY)
})

describe('MessageCompose', () => {
  it('restores a saved draft into an empty server-rendered textarea', async () => {
    sessionStorage.setItem(DRAFT_KEY, 'weitergeschriebener Entwurf')
    mountForm()
    await renderEntry()

    assert.equal(textarea().value, 'weitergeschriebener Entwurf', 'draft survives the reload')
    assert.equal(counter().textContent, '27/1000', 'counter reflects the restored draft')
  })

  it('a server-rendered value (rejected POST) re-saves as the draft', async () => {
    sessionStorage.setItem(DRAFT_KEY, 'alter Kram')
    mountForm()
    cleanup = render(
      <MessageCompose maxLength={1000} strippableWarning value="<eingereichter Text>" />,
      { container: mount! },
    ).cleanup

    assert.equal(sessionStorage.getItem(DRAFT_KEY), '<eingereichter Text>')
    assert.equal(textarea().value, '<eingereichter Text>')
  })

  it('typing saves the draft; clearing it removes the key', async () => {
    mountForm()
    await renderEntry()

    typeBody('Hallo')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'Hallo')

    typeBody('')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'an emptied body leaves no draft')
  })

  it('the counter tracks length and flags the limit', async () => {
    mountForm()
    await renderEntry()

    typeBody('12345')
    assert.equal(counter().textContent, '5/1000')
    assert.equal(counter().getAttribute('data-over-limit'), 'false')

    typeBody('x'.repeat(1000))
    assert.equal(counter().textContent, '1000/1000')
    assert.equal(counter().getAttribute('data-over-limit'), 'true')
  })

  it('warns only when the text contains characters the server strips', async () => {
    mountForm()
    await renderEntry()

    typeBody('ganz normaler text')
    assert.equal(warning().hidden, true, 'clean text never warns')

    typeBody('mit <Tag> und "Quote"')
    assert.equal(warning().hidden, false, 'stripped characters must be visible')

    typeBody('wieder sauber')
    assert.equal(warning().hidden, true)
  })

  it('submitting clears the draft so the next visit starts empty', async () => {
    mountForm()
    await renderEntry()

    typeBody('sende das jetzt')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'sende das jetzt')

    fixture!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null)
  })

  it('Ctrl/Cmd+Enter sends, a plain Enter only adds a line break', async () => {
    mountForm()
    await renderEntry()
    typeBody('per Tastatur senden')

    textarea().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    assert.equal(submitCount, 0, 'plain Enter must not send')

    textarea().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    assert.equal(submitCount, 1, 'Ctrl+Enter should submit the compose form')

    // Close the pending window before testing the other modifier; while a POST
    // is in flight the shortcut is intentionally ignored.
    testFrame!.dispatchEvent(new Event('reloadComplete'))

    textarea().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    assert.equal(submitCount, 2, 'Cmd+Enter should submit too')
  })

  it('Ctrl/Cmd+Enter sends once while the previous submit is pending', async () => {
    mountForm()
    await renderEntry()
    typeBody('nur einmal senden')

    let shortcut = () =>
      textarea().dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      )

    shortcut()
    assert.equal(submitCount, 1, 'the first shortcut submits')

    shortcut()
    assert.equal(submitCount, 1, 'a second shortcut must not race the pending POST')

    testFrame!.dispatchEvent(new Event('reloadComplete'))
    shortcut()
    assert.equal(submitCount, 2, 'the shortcut works again once the frame is back')
  })

  it('links the inline error to the textarea for assistive tech', async () => {
    mountForm()
    cleanup = render(
      <MessageCompose
        maxLength={1000}
        strippableWarning
        contentError="Nachricht darf nicht leer sein."
      />,
      { container: mount! },
    ).cleanup

    let field = textarea()
    assert.equal(field.getAttribute('aria-invalid'), 'true')
    assert.ok(
      field.getAttribute('aria-describedby')?.includes('messages-content-error'),
      'the error id must be part of aria-describedby',
    )
    let error = document.getElementById('messages-content-error') as HTMLElement
    assert.equal(error.getAttribute('role'), 'alert')
    assert.equal(error.textContent, 'Nachricht darf nicht leer sein.')
  })

  it('a click on the compose submit button also clears the draft', async () => {
    mountForm()
    await renderEntry()

    typeBody('noch im Entwurf')
    let btn = document.querySelector('button[type="submit"]') as HTMLElement
    btn.click()

    assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'submit click pre-clears the draft')
  })

  it('binding is idempotent across entry re-renders', async () => {
    mountForm()
    await renderEntry()

    typeBody('erster Text')
    cleanup?.()
    cleanup = null
    mount = document.createElement('div')
    fixture!.appendChild(mount)
    await renderEntry() // simulate a frame re-render with the same form DOM

    typeBody('zweiter Text')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'zweiter Text', 'one input → one save')
    assert.equal(counter().textContent, '12/1000', 'not doubled by re-bound listeners')
  })
})
