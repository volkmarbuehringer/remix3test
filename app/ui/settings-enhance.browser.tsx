import { clientEntry, css, type Handle } from 'remix/ui'

/**
 * Client-side UX enhancement for /settings. Rendered as a `clientEntry` so it
 * survives the client-side navigation swaps that replace the page content
 * after form submissions (inline `<script>`s in swapped-in HTML never run).
 *
 * Responsibilities:
 *   1. Live "Passwort-Anforderungen" checklist under the new-password field.
 *   2. Live "passwords match" indicator under the confirm field.
 *   3. Password visibility toggles (`[data-toggle-pw]`).
 *   4. Focus management: after a failed submit the server re-renders the panel
 *      with an error banner, but the swap leaves focus on <body> — move focus
 *      to the banner so keyboard + screen-reader users land on the message.
 *
 * This is progressive enhancement: without JS the form still works and the
 * server-side validation remains authoritative.
 */

function updateComplexity() {
  let list = document.querySelector('[data-pw-complexity]')
  if (!list) return
  let input = document.querySelector<HTMLInputElement>('input[name="newPassword"]')
  let value = input?.value ?? ''
  let rules: Array<[string, boolean]> = [
    ['length', value.length >= 10],
    ['digit', /[0-9]/.test(value)],
    ['special', /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value)],
  ]
  for (let [name, ok] of rules) {
    let li = list.querySelector(`li[data-complexity-rule="${name}"]`)
    li?.toggleAttribute('data-ok', ok)
  }
}

function updateMatch() {
  let hint = document.querySelector('[data-pw-match]')
  if (!hint) return
  let newPw = document.querySelector<HTMLInputElement>('input[name="newPassword"]')
  let confirm = document.querySelector<HTMLInputElement>('input[name="confirmPassword"]')
  if (!newPw || !confirm) return
  if (confirm.value.length === 0) {
    hint.textContent = ''
    hint.removeAttribute('data-match')
    return
  }
  if (confirm.value === newPw.value) {
    hint.textContent = 'Passwörter stimmen überein'
    hint.setAttribute('data-match', 'ok')
  } else {
    hint.textContent = 'Passwörter stimmen nicht überein'
    hint.setAttribute('data-match', 'bad')
  }
}

function onInput(event: Event) {
  let el = event.target as HTMLElement
  if (el.matches('input[name="newPassword"]')) {
    updateComplexity()
    updateMatch()
  } else if (el.matches('input[name="confirmPassword"]')) {
    updateMatch()
  }
}

function onToggleClick(event: Event) {
  let button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-toggle-pw]')
  if (!button) return
  let fieldName = button.getAttribute('data-toggle-pw')
  if (!fieldName) return
  let form = button.closest('form')
  if (!form) return
  let input = form.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`)
  if (!input) return
  // The login/register pages register a *delegated* document-level click
  // listener (PasswordToggle) that survives the client-side navigation into
  // /settings and would toggle the input a second time. Handle the toggle in
  // the capture phase and stop propagation so this entry is the single
  // authoritative owner of the eye toggles on this page.
  event.stopPropagation()
  let isPassword = input.type === 'password'
  input.type = isPassword ? 'text' : 'password'
  let useEl = button.querySelector('use')
  if (useEl) {
    let ref = isPassword ? '#rmx-glyph-eyeOff' : '#rmx-glyph-eye'
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', ref)
    useEl.setAttribute('href', ref)
  }
  let show = button.getAttribute('data-label-show') ?? 'Passwort anzeigen'
  let hide = button.getAttribute('data-label-hide') ?? 'Passwort ausblenden'
  button.setAttribute('aria-label', isPassword ? hide : show)
}

function focusBanner() {
  let alert = document.querySelector<HTMLElement>('[data-settings-alert]')
  if (alert) {
    alert.setAttribute('tabindex', '-1')
    alert.focus()
    return
  }
  let status = document.querySelector<HTMLElement>('[data-settings-status]')
  if (status) {
    status.setAttribute('tabindex', '-1')
    status.focus()
  }
}

// Module-scoped: guarantees exactly one delegated listener set per page load,
// even if the runtime re-creates the entry instance after a frame swap.
let listenersRegistered = false

function registerListeners() {
  if (listenersRegistered || typeof document === 'undefined') return
  listenersRegistered = true
  document.addEventListener('click', onToggleClick, { capture: true })
  document.addEventListener('input', onInput)
}

export const SettingsEnhance = clientEntry(
  import.meta.url + '#SettingsEnhance',
  function SettingsEnhance(handle: Handle) {
    return () => {
      registerListeners()
      if (typeof document !== 'undefined') {
        updateComplexity()
        updateMatch()
      }
      // Runs after every render, including the re-render that follows a
      // client-side form-navigation swap — that is when the error/success
      // banner appears and focus must move to it.
      handle.queueTask(focusBanner)
      return <div mix={css({ display: 'none' })} />
    }
  },
)
