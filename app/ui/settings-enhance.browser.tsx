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
 *   5. Delete-account gate: keep the destructive submit button disabled until
 *      the confirmation checkbox is ticked. Server-rendered HTML leaves the
 *      button enabled so the no-JS flow still works via the checkbox's
 *      `required` attribute.
 *   6. Submit feedback: disable the submitted button and relabel it so a slow
 *      response cannot be double-submitted and the user sees that work started.
 *   7. Tabs: turn the four stacked panels into ARIA tabs, keep the URL hash in
 *      sync for deep links (e.g. /settings#settings-password), and support
 *      Arrow/Home/End keyboard navigation. The server already renders the
 *      inactive panels hidden so the whole page cannot flash before this entry
 *      runs; an `@media (scripting: none)` rule in the page reveals every
 *      panel again when scripting is unavailable, so the tab anchors still
 *      scroll to their section.
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

// ── Tabs ──

function getSettingsTabs(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-settings-tab]'))
}

function getSettingsPanels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-settings-tabpanel]'))
}

function activateSettingsTab(
  panelId: string,
  options: { focus?: boolean; setHash?: boolean } = {},
) {
  let tabs = getSettingsTabs()
  let target = tabs.find((tab) => tab.getAttribute('aria-controls') === panelId)
  if (!target) return
  for (let tab of tabs) {
    let selected = tab === target
    tab.setAttribute('aria-selected', selected ? 'true' : 'false')
    tab.tabIndex = selected ? 0 : -1
  }
  for (let panel of getSettingsPanels()) {
    panel.hidden = panel.id !== panelId
  }
  document
    .querySelector('[data-settings-active-tab]')
    ?.setAttribute('data-settings-active-tab', panelId)
  if (options.focus) target.focus()
  if (options.setHash && window.location.hash !== `#${panelId}`) {
    // replaceState keeps the URL in sync for deep links/reloads without stacking
    // one history entry per arrow-key press.
    history.replaceState(null, '', `#${panelId}`)
  }
}

function initSettingsTabs() {
  if (typeof window === 'undefined') return
  let panels = getSettingsPanels()
  if (panels.length === 0) return
  let hash = window.location.hash.replace(/^#/, '')
  if (panels.some((panel) => panel.id === hash)) {
    activateSettingsTab(hash)
    return
  }
  // No hash: keep the tab the server marked selected (for example the password
  // tab after a failed submit) instead of forcing the first tab.
  let selected = getSettingsTabs().find((tab) => tab.getAttribute('aria-selected') === 'true')
  let selectedId = selected?.getAttribute('aria-controls') ?? panels[0]?.id
  if (selectedId) activateSettingsTab(selectedId)
}

function onTabClick(event: Event) {
  let tab = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-settings-tab]')
  if (!tab) return
  let panelId = tab.getAttribute('aria-controls')
  if (!panelId) return
  // Do not preventDefault: the anchor updates the URL hash and browser history,
  // and the browser scrolls the newly visible panel into view.
  activateSettingsTab(panelId)
}

function onTabKeyDown(event: KeyboardEvent) {
  let tab = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-settings-tab]')
  if (!tab) return
  let tabs = getSettingsTabs()
  let index = tabs.indexOf(tab)
  if (index === -1) return
  let nextIndex: number
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
  else if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = tabs.length - 1
  else return
  let next = tabs[nextIndex]
  let panelId = next?.getAttribute('aria-controls')
  if (!next || !panelId) return
  event.preventDefault()
  activateSettingsTab(panelId, { focus: true, setHash: true })
}

function onHashChange() {
  let hash = window.location.hash.replace(/^#/, '')
  if (getSettingsPanels().some((panel) => panel.id === hash)) {
    activateSettingsTab(hash)
  }
}

/**
 * The destructive button is only enabled once the confirmation checkbox is
 * ticked. Checkbox state is re-synced after every render because a failed
 * delete leaves the checkbox checked on the server-rendered HTML.
 */
function syncDeleteGate() {
  if (typeof document === 'undefined') return
  let checkbox = document.querySelector<HTMLInputElement>('input[data-delete-confirm]')
  let button = document.querySelector<HTMLButtonElement>('[data-delete-submit]')
  if (!checkbox || !button) return
  button.disabled = !checkbox.checked
}

function onChange(event: Event) {
  let el = event.target as HTMLElement
  if (el.matches('input[data-delete-confirm]')) {
    syncDeleteGate()
  }
}

/**
 * Relabel and lock the submitting button. Disabling a control during the submit
 * event does not cancel the submission, and native validation has already run
 * by the time a `submit` event fires.
 */
function onSubmit(event: Event) {
  let form = event.target
  if (!(form instanceof HTMLFormElement)) return
  let button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (!button || button.disabled || button.dataset.busy === 'true') return
  button.dataset.busy = 'true'
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.textContent = 'Wird gespeichert…'
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
  document.addEventListener('click', onTabClick)
  document.addEventListener('input', onInput)
  document.addEventListener('change', onChange)
  document.addEventListener('submit', onSubmit)
  document.addEventListener('keydown', onTabKeyDown)
  window.addEventListener('hashchange', onHashChange)
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
      handle.queueTask(() => {
        // Apply tab visibility first: focusBanner() targets an element inside
        // one of the panels and must not focus a hidden (display:none) node.
        initSettingsTabs()
        focusBanner()
        syncDeleteGate()
      })
      return <div mix={css({ display: 'none' })} />
    }
  },
)
