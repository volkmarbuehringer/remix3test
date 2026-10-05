import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { passwordComplexityScript } from './password-complexity-script.browser.tsx'

// ---------------------------------------------------------------------------
// passwordComplexityScript — the live checklist under the password inputs.
//
// Like PasswordToggle this is an inline <script>, not a clientEntry: the
// auth/settings pages render it server-side with a CSP nonce. The browser
// test injects the generated string once per file (a per-test injection would
// stack document input listeners and multiply the rewrites) against the same
// form shape the register form ships (auth pages.tsx: input[name=password] +
// div[data-pw-complexity] in the enclosing form).
// ---------------------------------------------------------------------------

let injected: HTMLScriptElement | null = null
let fixture: HTMLElement | null = null

function installScriptOnce() {
  let script = document.createElement('script')
  script.textContent = passwordComplexityScript('password')
  document.body.appendChild(script)
  injected = script
}

function mountForm(): void {
  let host = document.createElement('div')
  host.innerHTML = `
    <form action="#" method="post">
      <input type="password" name="password" id="pw" />
      <div data-pw-complexity></div>
      <input type="text" name="email" id="email" />
    </form>
  `
  document.body.appendChild(host)
  fixture = host
}

function type(fieldId: string, value: string): void {
  let field = document.getElementById(fieldId) as HTMLInputElement
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function feedback(): HTMLElement {
  return document.querySelector('[data-pw-complexity]') as HTMLElement
}

function ruleColors(): string[] {
  return [...feedback().querySelectorAll('span')].map((span) => span.style.color)
}

function ruleTexts(): string[] {
  return [...feedback().querySelectorAll('span')].map((span) => span.textContent ?? '')
}

describe('passwordComplexityScript', () => {
  before(() => {
    installScriptOnce()
  })

  afterEach(() => {
    fixture?.remove()
    fixture = null
  })

  it('renders the three unmet rules for an empty password', () => {
    mountForm()
    type('pw', '')

    assert.equal(feedback().querySelectorAll('span').length, 3, 'three rules always visible')
    assert.deepEqual(ruleTexts(), [
      '○ Mindestens 10 Zeichen',
      '○ Mindestens eine Zahl (0-9)',
      '○ Mindestens ein Sonderzeichen',
    ])
    assert.deepEqual(ruleColors(), Array(3).fill('rgb(107, 114, 128)'))
  })

  it('ticks the length rule at ten characters', () => {
    mountForm()
    type('pw', 'abcdefghij')

    assert.match(ruleTexts()[0]!, /^✓/)
    assert.equal(ruleColors()[0], 'rgb(22, 163, 74)')
    assert.match(ruleTexts()[1]!, /^○/)
    assert.match(ruleTexts()[2]!, /^○/)
  })

  it('ticks digits and special characters independently', () => {
    mountForm()
    type('pw', 'abcdefghij1')
    assert.match(ruleTexts()[1]!, /^✓/, 'digit met')
    assert.match(ruleTexts()[2]!, /^○/, 'no special char yet')

    type('pw', 'abcdefghij1$')
    assert.deepEqual(ruleTexts(), [
      '✓ Mindestens 10 Zeichen',
      '✓ Mindestens eine Zahl (0-9)',
      '✓ Mindestens ein Sonderzeichen',
    ])
    assert.deepEqual(ruleColors(), Array(3).fill('rgb(22, 163, 74)'))
  })

  it('ignores input events from other fields in the form', () => {
    mountForm()
    type('pw', 'abcdefghij1$')
    let snapshot = feedback().innerHTML

    type('email', 'someone@else')

    assert.equal(feedback().innerHTML, snapshot, 'only the watched field refreshes it')
  })

  it('does nothing when no feedback element sits in the form', () => {
    let host = document.createElement('div')
    host.innerHTML = `<form><input type="password" name="password" id="pw" /></form>`
    document.body.appendChild(host)
    fixture = host

    type('pw', 'abcdefghij1$') // must not throw

    assert.equal(host.querySelectorAll('[data-pw-complexity]').length, 0)
  })

  it('rejects field names that are not safe identifiers', () => {
    assert.throws(() => passwordComplexityScript('1bad'))
    assert.throws(() => passwordComplexityScript("a'; alert(1); //"))
    assert.doesNotThrow(() => passwordComplexityScript('newPassword'))
  })
})
