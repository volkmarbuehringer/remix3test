import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { SettingsEnhance } from './settings-enhance.browser.tsx'

// Browser-behavior coverage for the /settings client entry. The server-render
// contract (tab/tabpanel markup, which panel is server-visible) is already
// covered by controller.test.ts; these tests drive the DOM behaviors that only
// exist once SettingsEnhance runs.

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const TAB_IDS = ['settings-profile', 'settings-display', 'settings-password', 'settings-account']
const TAB_LABELS: Record<string, string> = {
  'settings-profile': 'Profil',
  'settings-display': 'Anzeige',
  'settings-password': 'Passwort',
  'settings-account': 'Konto',
}

function tabsHtml(selected = 'settings-profile'): string {
  let tabs = TAB_IDS.map(
    (id) => `
      <a
        href="#${id}"
        id="${id}-tab"
        role="tab"
        aria-controls="${id}"
        aria-selected="${id === selected}"
        tabindex="${id === selected ? 0 : -1}"
        data-settings-tab
      >${TAB_LABELS[id]}</a>`,
  ).join('')
  let panels = TAB_IDS.map(
    (id) => `
      <div
        id="${id}"
        role="tabpanel"
        aria-labelledby="${id}-tab"
        tabindex="0"
        data-settings-tabpanel
        ${id === selected ? '' : 'hidden'}
      >${TAB_LABELS[id]}</div>`,
  ).join('')
  return `<div role="tablist" aria-label="Bereiche der Einstellungen">${tabs}</div>
    <div data-settings-active-tab="${selected}">${panels}</div>`
}

function formsHtml(opts: { alert?: string; status?: string } = {}): string {
  return `
    <form id="pw-form" action="/settings" method="POST">
      <input id="new-password" type="password" name="newPassword" required minlength="10" />
      <button
        type="button"
        data-toggle-pw="newPassword"
        aria-label="Neues Passwort anzeigen"
        data-label-show="Neues Passwort anzeigen"
        data-label-hide="Neues Passwort ausblenden"
      ><svg><use xlink:href="#rmx-glyph-eye"></use></svg></button>
      <ul data-pw-complexity aria-label="Passwort-Anforderungen">
        <li data-complexity-rule="length">Mindestens 10 Zeichen</li>
        <li data-complexity-rule="digit">Mindestens eine Zahl (0-9)</li>
        <li data-complexity-rule="special">Mindestens ein Sonderzeichen</li>
      </ul>
      ${opts.alert ? `<p role="alert" data-settings-alert>${opts.alert}</p>` : ''}
      ${opts.status ? `<p role="status" data-settings-status>${opts.status}</p>` : ''}
      <input id="confirm-password" type="password" name="confirmPassword" required />
      <p data-pw-match role="status" aria-live="polite"></p>
      <button type="submit">Speichern</button>
    </form>
    <form id="del-form" action="/settings" method="POST">
      <input type="password" name="currentPassword" required />
      <input type="checkbox" name="confirmDelete" required data-delete-confirm />
      <button type="submit" data-delete-submit>Konto dauerhaft löschen</button>
    </form>
  `
}

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html: string): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function mountEntry() {
  cleanup = render(<SettingsEnhance />).cleanup
}

function newPassword(host: HTMLElement): HTMLInputElement {
  return host.querySelector('input[name="newPassword"]') as HTMLInputElement
}

function confirmPassword(host: HTMLElement): HTMLInputElement {
  return host.querySelector('input[name="confirmPassword"]') as HTMLInputElement
}

function tabOf(host: HTMLElement, id: string): HTMLAnchorElement {
  return host.querySelector(`[data-settings-tab][aria-controls="${id}"]`) as HTMLAnchorElement
}

function panelOf(host: HTMLElement, id: string): HTMLElement {
  return host.querySelector(`[data-settings-tabpanel]#${id}`) as HTMLElement
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function ruleOk(host: HTMLElement, rule: string): boolean {
  return host.querySelector(`li[data-complexity-rule="${rule}"]`)?.hasAttribute('data-ok') === true
}

function pressTab(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

beforeEach(() => {
  // Tab navigation writes `#<panel>` via history.replaceState; clear it so tests
  // cannot deep-link each other.
  history.replaceState(null, '', window.location.pathname + window.location.search)
})

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('SettingsEnhance password checklist', () => {
  it('tracks the complexity rules as the new password is typed', () => {
    let host = mount(formsHtml())
    mountEntry()

    assert.equal(ruleOk(host, 'length'), false, 'empty value fails every rule')

    typeInto(newPassword(host), 'abcdefghij')
    assert.equal(ruleOk(host, 'length'), true)
    assert.equal(ruleOk(host, 'digit'), false)
    assert.equal(ruleOk(host, 'special'), false)

    typeInto(newPassword(host), 'abcdefghij1')
    assert.equal(ruleOk(host, 'digit'), true)
    assert.equal(ruleOk(host, 'special'), false)

    typeInto(newPassword(host), 'abcdefghij1!')
    assert.equal(ruleOk(host, 'length'), true)
    assert.equal(ruleOk(host, 'digit'), true)
    assert.equal(ruleOk(host, 'special'), true)
  })

  it('reports a match only once the confirmation has a value', () => {
    let host = mount(formsHtml())
    mountEntry()
    let hint = host.querySelector('[data-pw-match]') as HTMLElement

    assert.equal(hint.textContent, '')

    typeInto(newPassword(host), 'abcdefghij1!')
    typeInto(confirmPassword(host), 'abcdefghij1!')
    assert.equal(hint.textContent, 'Passwörter stimmen überein')
    assert.equal(hint.getAttribute('data-match'), 'ok')

    typeInto(confirmPassword(host), 'abcdefghij1?')
    assert.equal(hint.textContent, 'Passwörter stimmen nicht überein')
    assert.equal(hint.getAttribute('data-match'), 'bad')

    // Editing the new password re-evaluates the match against the confirmation.
    typeInto(newPassword(host), 'different1!')
    assert.equal(hint.getAttribute('data-match'), 'bad')

    typeInto(confirmPassword(host), '')
    assert.equal(hint.textContent, '')
    assert.equal(hint.hasAttribute('data-match'), false)
  })

  it('toggles password visibility and its eye glyph', () => {
    let host = mount(formsHtml())
    mountEntry()
    let input = newPassword(host)
    let button = host.querySelector('[data-toggle-pw]') as HTMLButtonElement
    let use = button.querySelector('use') as SVGUseElement

    // The glyph names the action, not the state: <eye> means "show" while the
    // field is hidden, <eyeOff> means "hide" once it is revealed. Glyph renders
    // only xlink:href; the entry writes the plain href too.
    assert.equal(use.getAttributeNS(XLINK_NS, 'href'), '#rmx-glyph-eye')

    button.click()
    assert.equal(input.type, 'text')
    assert.equal(button.getAttribute('aria-label'), 'Neues Passwort ausblenden')
    assert.equal(use.getAttributeNS(XLINK_NS, 'href'), '#rmx-glyph-eyeOff')
    assert.equal(use.getAttribute('href'), '#rmx-glyph-eyeOff')

    button.click()
    assert.equal(input.type, 'password')
    assert.equal(button.getAttribute('aria-label'), 'Neues Passwort anzeigen')
    assert.equal(use.getAttributeNS(XLINK_NS, 'href'), '#rmx-glyph-eye')
  })

  it('stops the toggle click from reaching a delegated document listener', () => {
    let host = mount(formsHtml())
    mountEntry()
    let button = host.querySelector('[data-toggle-pw]') as HTMLButtonElement

    let bubbled = false
    let documentListener = () => {
      bubbled = true
    }
    document.addEventListener('click', documentListener)
    try {
      button.click()
    } finally {
      document.removeEventListener('click', documentListener)
    }

    assert.equal(bubbled, false, 'the capture listener should own the toggle')
    assert.equal(newPassword(host).type, 'text')
  })
})

describe('SettingsEnhance delete gate and submit feedback', () => {
  it('keeps the delete button disabled until the confirmation is ticked', () => {
    let host = mount(formsHtml())
    mountEntry()
    let checkbox = host.querySelector('input[data-delete-confirm]') as HTMLInputElement
    let button = host.querySelector('[data-delete-submit]') as HTMLButtonElement

    assert.equal(button.disabled, true, 'server renders it enabled; the entry syncs it')

    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    assert.equal(button.disabled, false)

    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    assert.equal(button.disabled, true)
  })

  it('disables and relabels the submitted button exactly once', () => {
    let host = mount(formsHtml())
    mountEntry()
    let form = host.querySelector('#pw-form') as HTMLFormElement
    let button = form.querySelector('button[type="submit"]') as HTMLButtonElement

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    assert.equal(button.disabled, true)
    assert.equal(button.getAttribute('aria-busy'), 'true')
    assert.equal(button.textContent, 'Wird gespeichert…')

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    assert.equal(button.textContent, 'Wird gespeichert…', 'the busy guard keeps the label stable')
  })

  it('moves focus to the error banner after a failed submit', () => {
    let host = mount(formsHtml({ alert: 'Passwort zu kurz', status: 'Gespeichert' }))
    mountEntry()
    let alert = host.querySelector('[data-settings-alert]') as HTMLElement

    assert.equal(document.activeElement, alert)
    assert.equal(alert.getAttribute('tabindex'), '-1')
  })

  it('falls back to the status banner when there is no error', () => {
    let host = mount(formsHtml({ status: 'Passwort geändert' }))
    mountEntry()
    let status = host.querySelector('[data-settings-status]') as HTMLElement

    assert.equal(document.activeElement, status)
    assert.equal(status.getAttribute('tabindex'), '-1')
  })
})

describe('SettingsEnhance tabs', () => {
  it('activates the server-selected tab and hides the others', () => {
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    assert.equal(tabOf(host, 'settings-profile').getAttribute('aria-selected'), 'true')
    assert.equal(tabOf(host, 'settings-profile').getAttribute('tabindex'), '0')
    assert.equal(tabOf(host, 'settings-password').getAttribute('aria-selected'), 'false')
    assert.equal(tabOf(host, 'settings-password').getAttribute('tabindex'), '-1')

    assert.equal(panelOf(host, 'settings-profile').hidden, false)
    assert.equal(panelOf(host, 'settings-password').hidden, true)
    assert.equal(
      host.querySelector('[data-settings-active-tab]')?.getAttribute('data-settings-active-tab'),
      'settings-profile',
    )
  })

  it('keeps the server-selected tab when the URL has no hash', () => {
    let host = mount(tabsHtml('settings-password'))
    mountEntry()

    assert.equal(tabOf(host, 'settings-password').getAttribute('aria-selected'), 'true')
    assert.equal(panelOf(host, 'settings-password').hidden, false)
    assert.equal(panelOf(host, 'settings-profile').hidden, true)
  })

  it('activates a tab when it is clicked', () => {
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    tabOf(host, 'settings-password').click()

    assert.equal(tabOf(host, 'settings-password').getAttribute('aria-selected'), 'true')
    assert.equal(tabOf(host, 'settings-password').getAttribute('tabindex'), '0')
    assert.equal(tabOf(host, 'settings-profile').getAttribute('aria-selected'), 'false')
    assert.equal(panelOf(host, 'settings-password').hidden, false)
    assert.equal(panelOf(host, 'settings-profile').hidden, true)
    assert.equal(
      host.querySelector('[data-settings-active-tab]')?.getAttribute('data-settings-active-tab'),
      'settings-password',
    )
  })

  it('wraps with ArrowRight / ArrowLeft and focuses the new tab', () => {
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    pressTab(tabOf(host, 'settings-profile'), 'ArrowRight')
    assert.equal(document.activeElement, tabOf(host, 'settings-display'))
    assert.equal(tabOf(host, 'settings-display').getAttribute('aria-selected'), 'true')

    // Wrap past the last tab back to the first.
    pressTab(tabOf(host, 'settings-display'), 'ArrowLeft')
    assert.equal(document.activeElement, tabOf(host, 'settings-profile'))

    pressTab(tabOf(host, 'settings-profile'), 'ArrowLeft')
    assert.equal(document.activeElement, tabOf(host, 'settings-account'))

    pressTab(tabOf(host, 'settings-account'), 'ArrowRight')
    assert.equal(document.activeElement, tabOf(host, 'settings-profile'))
  })

  it('jumps to the first and last tab with Home and End', () => {
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    pressTab(tabOf(host, 'settings-profile'), 'End')
    assert.equal(document.activeElement, tabOf(host, 'settings-account'))
    assert.equal(tabOf(host, 'settings-account').getAttribute('aria-selected'), 'true')

    pressTab(tabOf(host, 'settings-account'), 'Home')
    assert.equal(document.activeElement, tabOf(host, 'settings-profile'))
  })

  it('keeps the URL hash in sync during keyboard navigation', () => {
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    pressTab(tabOf(host, 'settings-profile'), 'ArrowRight')
    assert.equal(window.location.hash, '#settings-display')

    pressTab(tabOf(host, 'settings-display'), 'End')
    assert.equal(window.location.hash, '#settings-account')
  })

  it('deep-links to the panel named by the URL hash on load', () => {
    history.replaceState(null, '', '#settings-account')
    let host = mount(tabsHtml('settings-profile'))
    mountEntry()

    assert.equal(tabOf(host, 'settings-account').getAttribute('aria-selected'), 'true')
    assert.equal(panelOf(host, 'settings-account').hidden, false)
    assert.equal(panelOf(host, 'settings-profile').hidden, true)
  })
})
