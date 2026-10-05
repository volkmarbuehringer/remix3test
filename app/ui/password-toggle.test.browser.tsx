import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { PASSWORD_TOGGLE_SCRIPT } from './password-toggle.script.ts'

// ---------------------------------------------------------------------------
// PasswordToggle — the eye button on auth/settings password fields.
//
// This is NOT a clientEntry: the module renders a plain <script> with a CSP
// nonce (see auth-card / auth pages), so the runtime that hydrates entries is
// not involved. The browser test injects the same script string exactly ONCE
// per file the way the browser would execute it, then drives real fixtures.
// Injecting per test would stack N document click listeners — each click
// would flip the input type N times.
// ---------------------------------------------------------------------------

function installScriptOnce() {
  let script = document.createElement('script')
  script.textContent = PASSWORD_TOGGLE_SCRIPT
  document.body.appendChild(script)
  injected = script
}

let injected: HTMLScriptElement | null = null
let fixture: HTMLElement | null = null

function mountForm(): void {
  let host = document.createElement('div')
  host.innerHTML = `
    <form action="#" method="post">
      <input type="password" name="password" id="pw" />
      <button
        type="button"
        data-toggle-pw="password"
        data-label-show="Passwort anzeigen"
        data-label-hide="Passwort ausblenden"
        aria-label="Passwort anzeigen"
      >
        <svg><use xlink:href="#rmx-glyph-eye" /></svg>
      </button>
      <button type="button" data-toggle-pw="" id="empty-name">kaputt</button>
      <button type="button" id="plain-btn">kein Toggle</button>
    </form>
  `
  document.body.appendChild(host)
  fixture = host
}

function pw(): HTMLInputElement {
  return document.getElementById('pw') as HTMLInputElement
}

function toggleBtn(): HTMLElement {
  return fixture?.querySelector('[data-toggle-pw="password"]') as HTMLElement
}

function useEl(): Element | null {
  return toggleBtn().querySelector('use')
}

describe('PasswordToggle script', () => {
  before(() => {
    installScriptOnce()
  })

  afterEach(() => {
    fixture?.remove()
    fixture = null
  })

  it('reveals the password: type flips, glyph points at eyeOff, label swaps', () => {
    mountForm()
    assert.equal(pw().type, 'password', 'sanity: masked initially')

    toggleBtn().click()

    assert.equal(pw().type, 'text', 'click reveals')
    assert.equal(useEl()?.getAttribute('href'), '#rmx-glyph-eyeOff')
    assert.equal(useEl()?.getAttribute('xlink:href'), '#rmx-glyph-eyeOff')
    assert.equal(toggleBtn().getAttribute('aria-label'), 'Passwort ausblenden')
  })

  it('masks again on the second click and restores the eye glyph', () => {
    mountForm()

    let btn = toggleBtn()
    btn.click()
    btn.click()

    assert.equal(pw().type, 'password')
    assert.equal(useEl()?.getAttribute('href'), '#rmx-glyph-eye')
    assert.equal(btn.getAttribute('aria-label'), 'Passwort anzeigen')
  })

  it('works when the click lands on the inner glyph (closest)', () => {
    mountForm()

    let use = useEl() as Element
    use.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    assert.equal(pw().type, 'text')
  })

  it('ignores a toggle with an empty field name', () => {
    mountForm()

    ;(document.getElementById('empty-name') as HTMLElement).click()

    assert.equal(pw().type, 'password', 'no field name → no field lookup')
  })

  it('ignores plain buttons and other inputs', () => {
    mountForm()

    ;(document.getElementById('plain-btn') as HTMLElement).click()

    assert.equal(pw().type, 'password')
    assert.equal(toggleBtn().getAttribute('aria-label'), 'Passwort anzeigen')
  })

  it('does nothing when the named input is missing from the form', () => {
    let host = document.createElement('div')
    host.innerHTML = `
      <form action="#" method="post">
        <button type="button" data-toggle-pw="password" aria-label="Passwort anzeigen">t</button>
      </form>
    `
    document.body.appendChild(host)
    fixture = host

    host.querySelector('button')!.click() // must not throw

    assert.equal(host.querySelectorAll('input').length, 0)
  })
})
