import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { DirtyFormGuard } from './dirty-form-guard.browser.tsx'

// ---------------------------------------------------------------------------
// DirtyFormGuard — don't silently lose half-typed panel edits.
//
// The entry lives INSIDE the guarded form (it resolves it via closest()), so
// the test renders into a mount point inside a real fixture form. Covered:
// dirty detection vs the server-rendered baseline (value/defaultValue,
// checkbox defaultChecked, `_`-prefixed fields skipped), the data-dirty
// attribute lifecycle, submit dropping the guard, the beforeunload veto, and
// the click interception matrix (outside link = ask; in-form link = explicit
// discard; other-form GET submit = ask; other-form POST = its own confirm).
// The window.confirm seam is stubbed; location navigation is unforgeable, so
// the interception is asserted via preventDefault on a cancelable click, not
// by watching where the browser ends up.
// ---------------------------------------------------------------------------

const originalConfirm = window.confirm

let fixture: HTMLElement | null = null
let cleanups: Array<() => void> = []
let confirmMessages: string[] = []

const FORM_HTML = `
  <form id="panel-form" action="#" method="post">
    <input name="title" value="Gespeichter Titel" />
    <textarea name="desc">Baseline</textarea>
    <input type="checkbox" name="aktiv" value="on" />
    <input type="hidden" name="_grid" value="page=2" />
    <a id="in-form-link" href="#abbrechen">Abbrechen</a>
    <button type="submit" id="form-submit">Speichern</button>
    <div id="guard-mount"></div>
  </form>
  <a id="outside-link" href="#andere-seite">Navigation</a>
  <form id="filter-form" action="#" method="get">
    <button type="submit" id="filter-submit">Filtern</button>
  </form>
  <form id="delete-form" action="#" method="post">
    <button type="submit" id="delete-submit">Zeile löschen</button>
  </form>
`

function mount(): void {
  let host = document.createElement('div')
  host.innerHTML = FORM_HTML
  document.body.appendChild(host)
  fixture = host
  // Never let a submit navigate.
  host
    .querySelectorAll('form')
    .forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()))
}

function mountGuard(): void {
  let mountPoint = document.getElementById('guard-mount') as HTMLElement
  cleanups.push(render(<DirtyFormGuard />, { container: mountPoint }).cleanup)
}

function el(id: string): HTMLElement {
  let node = document.getElementById(id)
  assert.ok(node, `fixture element #${id} must exist`)
  return node
}

function form(): HTMLFormElement {
  return el('panel-form') as HTMLFormElement
}

function typeInto(name: string, value: string): void {
  let field = form().querySelector(`[name="${name}"]`) as HTMLInputElement
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function cancelableClick(node: HTMLElement): MouseEvent {
  let event = new MouseEvent('click', { bubbles: true, cancelable: true })
  node.dispatchEvent(event)
  return event
}

function stubConfirm(answer: boolean): void {
  confirmMessages = []
  window.confirm = ((message?: string) => {
    confirmMessages.push(message ?? '')
    return answer
  }) as typeof window.confirm
}

afterEach(() => {
  cleanups.forEach((fn) => fn())
  cleanups = []
  fixture?.remove()
  fixture = null
  window.confirm = originalConfirm
  // Accepted anchor clicks land a #hash; reset so it cannot leak between tests.
  history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('DirtyFormGuard', () => {
  it('marks the form dirty when a field deviates from the server value', () => {
    mount()
    mountGuard()

    typeInto('title', 'Halb getippt')

    assert.equal(form().getAttribute('data-dirty'), 'true')
  })

  it('clears the dirty flag when the edit is undone', () => {
    mount()
    mountGuard()

    typeInto('title', 'Halb getippt')
    assert.equal(form().getAttribute('data-dirty'), 'true')

    typeInto('title', 'Gespeichter Titel')
    assert.equal(form().hasAttribute('data-dirty'), false, 'back to baseline = clean')
  })

  it('skips `_`-prefixed machinery fields (grid/session state)', () => {
    mount()
    mountGuard()

    typeInto('_grid', 'page=9')

    assert.equal(form().hasAttribute('data-dirty'), false, 'hidden machinery is not user input')
  })

  it('treats a checkbox flip as dirty via defaultChecked', () => {
    mount()
    mountGuard()

    let box = form().querySelector('[name="aktiv"]') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('input', { bubbles: true }))

    assert.equal(form().getAttribute('data-dirty'), 'true')
  })

  it('drops the guard on submit — an intentional save never warns', () => {
    mount()
    mountGuard()

    typeInto('title', 'Neu')
    form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    assert.equal(form().hasAttribute('data-dirty'), false, 'submit clears the flag')

    typeInto('title', 'Noch was') // would normally re-dirty
    let event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    assert.equal(event.defaultPrevented, false, 'after submit the guard stays off')
  })

  it('vetoes beforeunload while dirty and lets it pass while clean', () => {
    mount()
    mountGuard()

    let cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    assert.equal(cleanEvent.defaultPrevented, false, 'clean form may leave freely')

    typeInto('desc', 'Rohbau')
    let dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    // The entry also assigns event.returnValue = '' (the legacy signal); on a
    // synthetic Event that assignment routes back into preventDefault, so
    // defaultPrevented is the engine-honest assertion of the veto.
    assert.equal(dirtyEvent.defaultPrevented, true, 'dirty form must block the unload')
  })

  it('asks before an outside link discards the edits, and blocks the click on cancel', () => {
    mount()
    mountGuard()
    stubConfirm(false)
    typeInto('title', 'Weg damit?')

    let event = cancelableClick(el('outside-link'))

    assert.deepEqual(confirmMessages, ['Nicht gespeicherte Änderungen verwerfen?'])
    assert.equal(event.defaultPrevented, true, 'a declined confirm must cancel navigation')
  })

  it('lets the outside link through when the user accepts the loss', () => {
    mount()
    mountGuard()
    stubConfirm(true)
    typeInto('title', 'Weg damit?')

    let event = cancelableClick(el('outside-link'))

    assert.equal(confirmMessages.length, 1)
    assert.equal(event.defaultPrevented, false, 'accepted → the navigation proceeds')
  })

  it('does not ask for links inside the guarded form (Abbrechen is explicit)', () => {
    mount()
    mountGuard()
    stubConfirm(false)
    typeInto('title', 'Weg damit?')

    cancelableClick(el('in-form-link'))

    assert.deepEqual(confirmMessages, [], 'in-form links are an intentional discard')
  })

  it('asks for a submit in another GET form, but never for another POST form', () => {
    mount()
    mountGuard()
    stubConfirm(false)
    typeInto('title', 'Weg damit?')

    cancelableClick(el('filter-submit'))
    assert.deepEqual(confirmMessages, ['Nicht gespeicherte Änderungen verwerfen?'])

    stubConfirm(false)
    cancelableClick(el('delete-submit'))
    assert.deepEqual(confirmMessages, [], 'POST forms run their own confirm')
  })

  it('stays silent for every control while the form is clean', () => {
    mount()
    mountGuard()
    stubConfirm(false)

    cancelableClick(el('outside-link'))
    cancelableClick(el('filter-submit'))

    assert.deepEqual(confirmMessages, [], 'nothing to lose, nothing to ask')
  })
})
