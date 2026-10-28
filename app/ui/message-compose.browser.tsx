import { clientEntry, css, ref, type Handle } from 'remix/component'

import { input } from './mixins/input.ts'
import { theme } from './theme/theme.ts'

/**
 * Compose textarea + live meta for /admin/messages (server-rendered, then
 * hydrated — the textarea and its counter/warning meta are component-owned
 * DOM, so all listeners clean up with the element's signal on frame swap).
 *
 * Three jobs the server render cannot do on its own:
 *
 * 1. Draft persistence. The compose textarea lives inside the admin content
 *    frame and the live ConnectionIndicator calls frame.reload() on every SSE
 *    invalidate. Without a draft, any message posted by someone else while you
 *    are typing silently wipes your in-progress text. The draft is kept in
 *    sessionStorage, cleared on submit, and re-saved from the server-rendered
 *    value when a rejected POST re-renders the page with the submitted text.
 *    At bind time the DOM value is the server-rendered one and wins over the
 *    draft (see `app/actions/admin/messages` for the re-render flow).
 * 2. A live character counter for the maxLength limit.
 * 3. A warning when the text contains characters the server strips
 *    (< > ' " &), so sanitization is never silent.
 */
const DRAFT_KEY = 'admin-messages-compose-draft'
const STRIPPED_PATTERN = /[<>'"&]/

interface MessageComposeProps {
  /** Hard character limit mirrored on the textarea and the live counter. */
  maxLength: number
  /** Live-warn when the text contains characters the server strips. */
  strippableWarning?: boolean
  /** Server-rendered value; a rejected POST re-render resubmits the text. */
  value?: string | undefined
  /** Per-field validation error shown under the textarea. */
  contentError?: string | undefined
  /** Form-level validation error shown under the textarea. */
  formError?: string | undefined
}

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

function updateMeta(textarea: HTMLTextAreaElement, maxLength: number): void {
  let value = textarea.value
  // Scope the meta lookups to the compose form instead of the document: the
  // counter and warning render next to the textarea inside the same form.
  let counter = textarea.form?.querySelector<HTMLElement>('[data-compose-counter]')
  if (counter) {
    counter.textContent = value.length + '/' + maxLength
    counter.setAttribute('data-over-limit', value.length >= maxLength ? 'true' : 'false')
  }
  let warning = textarea.form?.querySelector<HTMLElement>('[data-compose-warning]')
  if (warning) {
    warning.hidden = !STRIPPED_PATTERN.test(value)
  }
}

const MIN_TEXTAREA_HEIGHT = 40
const MAX_TEXTAREA_HEIGHT = 240

/**
 * Grow the compose box with its content, up to the CSS max-height, then scroll
 * internally. A fixed one-row textarea made longer messages hard to review
 * before sending, while a permanently tall box wasted vertical space above the
 * grid.
 */
function autoSize(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto'
  let next = Math.min(MAX_TEXTAREA_HEIGHT, Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight))
  textarea.style.height = next + 'px'
  textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
}

function describedBy(contentError?: string, formError?: string): string {
  let ids = ['messages-content-meta']
  if (contentError) ids.push('messages-content-error')
  if (formError) ids.push('messages-content-form-error')
  return ids.join(' ')
}

export const MessageCompose = clientEntry(
  import.meta.url + '#MessageCompose',
  function MessageCompose(handle: Handle<MessageComposeProps>) {
    // The factory closure survives a frame reload, so the guard is cleared when
    // the swap finishes instead of staying latched for the rest of the page.
    let submitting = false

    if (typeof document !== 'undefined') {
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          submitting = false
        },
        { signal: handle.signal },
      )
    }

    return () => {
      let { maxLength, strippableWarning, value = '', contentError, formError } = handle.props

      return (
        <>
          <textarea
            id="messages-content"
            name="content"
            required
            maxLength={maxLength}
            placeholder="Nachricht schreiben…"
            defaultValue={value}
            aria-invalid={contentError ? true : undefined}
            aria-describedby={describedBy(contentError, formError)}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            mix={[
              input.base,
              input.focus,
              textareaStyle,
              ...(contentError ? [input.error] : []),
              ref((node, signal) => {
                let textarea = node as HTMLTextAreaElement

                // At bind time the DOM value is the server-rendered one: a
                // rejected POST re-renders with the submitted text, a
                // successful/plain render is empty.
                let serverValue = textarea.value
                if (serverValue) {
                  saveDraft(serverValue)
                } else {
                  let draft = readDraft()
                  if (draft) textarea.value = draft
                }

                textarea.addEventListener(
                  'input',
                  () => {
                    saveDraft(textarea.value)
                    updateMeta(textarea, maxLength)
                    autoSize(textarea)
                  },
                  { signal },
                )

                // Ctrl/Cmd+Enter sends without reaching for the mouse, matching
                // the shortcut admins already know from chat composers.
                textarea.addEventListener(
                  'keydown',
                  (event) => {
                    if (event.isComposing || event.keyCode === 229) return
                    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
                    event.preventDefault()
                    // The shared pending button disables itself, but a second
                    // shortcut would still submit and race the first POST
                    // (duplicate message or a rate-limit error). The form
                    // submit listener below sets the guard synchronously.
                    if (submitting) return
                    textarea.form?.requestSubmit()
                  },
                  { signal },
                )

                // The draft clears when the compose form submits and when its
                // submit button is clicked (pre-clears even when native
                // validation cancels the submission). Both listeners are bound
                // to the textarea's signal so a frame swap unbinds them.
                let form = textarea.form
                if (form) {
                  form.addEventListener(
                    'submit',
                    () => {
                      submitting = true
                      clearDraft()
                    },
                    { capture: true, signal },
                  )
                  form.addEventListener(
                    'click',
                    (event) => {
                      let target = event.target as HTMLElement | null
                      if (target && target.closest('button[type="submit"]')) clearDraft()
                    },
                    { capture: true, signal },
                  )
                }

                autoSize(textarea)
                updateMeta(textarea, maxLength)
              }),
            ]}
          />
          {contentError ? (
            <div id="messages-content-error" role="alert" mix={fieldErrorStyle}>
              {contentError}
            </div>
          ) : null}
          {formError ? (
            <div id="messages-content-form-error" role="alert" mix={formErrorStyle}>
              {formError}
            </div>
          ) : null}
          <div id="messages-content-meta" mix={composeMetaStyle}>
            <span
              data-compose-counter
              data-over-limit={value.length >= maxLength ? 'true' : 'false'}
              mix={composeCounterStyle}
            >
              {value.length + '/' + maxLength}
            </span>
            {strippableWarning ? (
              <span data-compose-warning hidden mix={composeWarningStyle}>
                {'Zeichen wie < > & \' " werden beim Senden entfernt.'}
              </span>
            ) : null}
          </div>
        </>
      )
    }
  },
)

// ── Styles (moved from admin-messages-page.tsx with the markup) ──

const textareaStyle = css({
  // The entry grows the box with its content (see autoSize); a manual resize
  // handle would fight that measured height.
  resize: 'none',
  minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
  maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
})

/** Live character counter + strip warning sit under the textarea. */
const composeMetaStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  marginTop: theme.space.xs,
})

const composeCounterStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  fontVariantNumeric: 'tabular-nums',
  '&[data-over-limit="true"]': {
    color: theme.colors.action.danger.background,
    fontWeight: theme.fontWeight.semibold,
  },
})

const composeWarningStyle = css({
  padding: '2px ' + theme.space.sm,
  borderRadius: theme.radius.full,
  background: theme.colors.warning.background,
  color: theme.colors.warning.foreground,
  fontSize: theme.fontSize.xs,
})

const fieldErrorStyle = css({
  marginTop: theme.space.xs,
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.xs,
})

const formErrorStyle = css({
  marginTop: theme.space.sm,
  padding: theme.space.xs + ' ' + theme.space.sm,
  borderRadius: theme.radius.md,
  background: theme.colors.warning.background,
  color: theme.colors.warning.foreground,
  fontSize: theme.fontSize.sm,
})
