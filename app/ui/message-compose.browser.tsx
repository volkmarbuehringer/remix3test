import { clientEntry, css, type Handle } from 'remix/ui'

/**
 * Compose-box enhancement for /admin/messages.
 *
 * Three jobs the server render cannot do on its own:
 *
 * 1. Draft persistence. The compose textarea lives inside the admin content
 *    frame and the live ConnectionIndicator calls frame.reload() on every SSE
 *    invalidate. Without a draft, any message posted by someone else while you
 *    are typing silently wipes your in-progress text. The draft is kept in
 *    sessionStorage, cleared on submit, and re-saved from the server-rendered
 *    value when a rejected POST re-renders the page with the submitted text.
 * 2. A live character counter for the 1000-char limit.
 * 3. A warning when the text contains characters the server strips
 *    (< > ' " &), so sanitization is never silent.
 *
 * A single document-level submit/click pair is registered once per page load
 * (module-scoped guard, matching message-expand), so it survives frame swaps.
 */
const DRAFT_KEY = 'admin-messages-compose-draft'
const MAX_LENGTH = 1000
const STRIPPED_PATTERN = /[<>'"&]/

let listenersRegistered = false

function saveDraft(value: string): void {
  try {
    if (value) sessionStorage.setItem(DRAFT_KEY, value)
    else sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable */
  }
}

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* storage unavailable */
  }
}

function updateMeta(textarea: HTMLTextAreaElement): void {
  let value = textarea.value
  let counter = document.querySelector<HTMLElement>('[data-compose-counter]')
  if (counter) {
    counter.textContent = value.length + '/' + MAX_LENGTH
    counter.setAttribute('data-over-limit', value.length >= MAX_LENGTH ? 'true' : 'false')
  }
  let warning = document.querySelector<HTMLElement>('[data-compose-warning]')
  if (warning) {
    warning.hidden = !STRIPPED_PATTERN.test(value)
  }
}

function bindTextarea(textarea: HTMLTextAreaElement): void {
  if (textarea.dataset.composeBound === 'true') return
  textarea.dataset.composeBound = 'true'

  // At bind time the DOM value is the server-rendered one: a rejected POST
  // re-renders with the submitted text, a successful/plain render is empty.
  let serverValue = textarea.value
  if (serverValue) {
    saveDraft(serverValue)
  } else {
    let draft = readDraft()
    if (draft) textarea.value = draft
  }

  textarea.addEventListener('input', () => {
    saveDraft(textarea.value)
    updateMeta(textarea)
  })

  updateMeta(textarea)
}

function onDocumentSubmit(event: Event): void {
  let form = event.target as HTMLElement | null
  if (!form || form.id !== 'messages-compose-form') return
  clearDraft()
}

function onDocumentClick(event: Event): void {
  let target = event.target as HTMLElement | null
  if (target && target.closest('[data-compose-submit]')) clearDraft()
}

function registerListeners(): void {
  if (listenersRegistered || typeof document === 'undefined') return
  listenersRegistered = true
  document.addEventListener('submit', onDocumentSubmit, { capture: true })
  document.addEventListener('click', onDocumentClick, { capture: true })
}

function scan(): void {
  if (typeof document === 'undefined') return
  document
    .querySelectorAll<HTMLTextAreaElement>('#messages-content')
    .forEach((textarea) => bindTextarea(textarea))
}

export const MessageCompose = clientEntry(
  import.meta.url + '#MessageCompose',
  function MessageCompose(handle: Handle) {
    return () => {
      registerListeners()
      handle.queueTask(scan)
      return <div mix={css({ display: 'none' })} />
    }
  },
)
