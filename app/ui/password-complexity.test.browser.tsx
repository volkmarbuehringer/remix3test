import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { PasswordComplexityChecklist } from './password-complexity.browser.tsx'

// ---------------------------------------------------------------------------
// PasswordComplexityChecklist — the live checklist under the password inputs.
//
// The checklist is component-owned DOM: one hydrated container per password
// form; the password `input` events bubble into it and refresh the three rule
// rows via textContent (never innerHTML). Tests mount a form fixture with the
// input shape the register form ships (auth pages.tsx:
// input[name=password] inside the same form) and render the checklist into it.
// ---------------------------------------------------------------------------

let fixture: HTMLFormElement | null = null
let mount: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mountForm(): void {
  let host = document.createElement('form')
  host.setAttribute('action', '#')
  host.setAttribute('method', 'post')
  host.innerHTML = `
    <input type="password" name="password" id="pw" />
    <input type="text" name="email" id="email" />
  `
  mount = document.createElement('div')
  host.appendChild(mount)
  document.body.appendChild(host)
  fixture = host
}

function renderChecklist(fieldName = 'password'): void {
  let result = render(<PasswordComplexityChecklist fieldName={fieldName} />, {
    container: mount!,
  })
  cleanup = result.cleanup
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

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  mount = null
})

describe('PasswordComplexityChecklist', () => {
  it('renders the three unmet rules for an empty password', () => {
    mountForm()
    renderChecklist()
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
    renderChecklist()
    type('pw', 'abcdefghij')

    assert.match(ruleTexts()[0]!, /^✓/)
    assert.equal(ruleColors()[0], 'rgb(22, 163, 74)')
    assert.match(ruleTexts()[1]!, /^○/)
    assert.match(ruleTexts()[2]!, /^○/)
  })

  it('ticks digits and special characters independently', () => {
    mountForm()
    renderChecklist()
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
    renderChecklist()
    type('pw', 'abcdefghij1$')
    let snapshot = feedback().innerHTML

    type('email', 'someone@else')

    assert.equal(feedback().innerHTML, snapshot, 'only the watched field refreshes it')
  })

  it('stays empty until the watched field emits its first input event', () => {
    mountForm()
    renderChecklist()

    assert.equal(feedback().children.length, 0, 'no rules before any input')

    type('pw', 'a')
    assert.equal(feedback().children.length, 3, 'rules appear on first input')
  })

  it('only reacts to the configured field name', () => {
    mountForm()
    renderChecklist('newPassword')
    type('pw', 'abcdefghij1$')

    assert.equal(feedback().children.length, 0, 'a different name does not match')
  })
})
