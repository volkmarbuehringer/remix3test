import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { MessageCompose } from './message-compose.browser.tsx'

// ---------------------------------------------------------------------------
// MessageCompose — draft persistence, char counter, sanitization warning.
//
// The compose textarea (server id `messages-content`) is bound by a
// module-guarded document listener pair (submit/click clear the draft) plus a
// post-render queueTask scan. Tests mount a fresh form fixture per case and
// render the entry to trigger the scan; sessionStorage is the store, so every
// case starts and ends with the draft key cleared.
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'admin-messages-compose-draft'

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mountForm(serverValue = ''): void {
  let host = document.createElement('div')
  host.innerHTML = `
    <form id="messages-compose-form" action="#" method="post">
      <textarea id="messages-content" name="body" rows="4">${serverValue}</textarea>
      <div id="messages-content-meta">
        <span data-compose-counter>0/1000</span>
        <span data-compose-warning hidden>Achtung: Diese Zeichen werden entfernt.</span>
      </div>
      <button type="submit" data-compose-submit="true">Senden</button>
    </form>
  `
  document.body.appendChild(host)
  fixture = host
  host.querySelector('form')!.addEventListener('submit', (e) => e.preventDefault())
}

async function renderEntry(): Promise<RenderResult> {
  let result = render(<MessageCompose />)
  cleanup = result.cleanup
  await result.act(() => undefined) // flush the queued scan()
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
  sessionStorage.removeItem(DRAFT_KEY)
})

describe('MessageCompose', () => {
  it('restores a saved draft into an empty server-rendered textarea', async () => {
    sessionStorage.setItem(DRAFT_KEY, 'weitergeschriebener Entwurf')
    mountForm('')
    await renderEntry()

    assert.equal(textarea().value, 'weitergeschriebener Entwurf', 'draft survives the reload')
    assert.equal(counter().textContent, '27/1000', 'counter reflects the restored draft')
  })

  it('a server-rendered value (rejected POST) re-saves as the draft', async () => {
    sessionStorage.setItem(DRAFT_KEY, 'alter Kram')
    mountForm('<eingereichter Text>')
    await renderEntry()

    assert.equal(sessionStorage.getItem(DRAFT_KEY), '<eingereichter Text>')
    assert.equal(textarea().value, '<eingereichter Text>')
  })

  it('typing saves the draft; clearing it removes the key', async () => {
    mountForm('')
    await renderEntry()

    typeBody('Hallo')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'Hallo')

    typeBody('')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'an emptied body leaves no draft')
  })

  it('the counter tracks length and flags the limit', async () => {
    mountForm('')
    await renderEntry()

    typeBody('12345')
    assert.equal(counter().textContent, '5/1000')
    assert.equal(counter().getAttribute('data-over-limit'), 'false')

    typeBody('x'.repeat(1000))
    assert.equal(counter().textContent, '1000/1000')
    assert.equal(counter().getAttribute('data-over-limit'), 'true')
  })

  it('warns only when the text contains characters the server strips', async () => {
    mountForm('')
    await renderEntry()

    typeBody('ganz normaler text')
    assert.equal(warning().hidden, true, 'clean text never warns')

    typeBody('mit <Tag> und "Quote"')
    assert.equal(warning().hidden, false, 'stripped characters must be visible')

    typeBody('wieder sauber')
    assert.equal(warning().hidden, true)
  })

  it('submitting clears the draft so the next visit starts empty', async () => {
    mountForm('')
    await renderEntry()

    typeBody('sende das jetzt')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'sende das jetzt')

    document
      .getElementById('messages-compose-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null)
  })

  it('a click on the compose submit button also clears the draft', async () => {
    mountForm('')
    await renderEntry()

    typeBody('noch im Entwurf')
    let btn = document.querySelector('[data-compose-submit]') as HTMLElement
    btn.click()

    assert.equal(sessionStorage.getItem(DRAFT_KEY), null, 'submit click pre-clears the draft')
  })

  it('binding is idempotent across entry re-renders', async () => {
    mountForm('')
    await renderEntry()

    typeBody('erster Text')
    cleanup?.()
    cleanup = null
    await renderEntry() // simulate a frame re-render with the same DOM

    typeBody('zweiter Text')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), 'zweiter Text', 'one input → one save')
    assert.equal(counter().textContent, '12/1000', 'not doubled by re-bound listeners')
  })
})
