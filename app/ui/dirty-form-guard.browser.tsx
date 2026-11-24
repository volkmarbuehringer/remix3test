import { clientEntry, css, ref, type Handle } from 'remix/component'
import { requestConfirmDecision } from './confirm-delete.browser.tsx'

const hiddenStyle = css({ display: 'none' })
const DISCARD_MESSAGE = 'Nicht gespeicherte Änderungen verwerfen?'

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

type PendingNavigation =
  | { kind: 'link'; anchor: HTMLAnchorElement }
  | { kind: 'form'; form: HTMLFormElement; submitter: HTMLButtonElement | HTMLInputElement }

/** The fields the user can actually lose (skip hidden grid/session state). */
function editableFields(form: HTMLFormElement): Field[] {
  let fields: Field[] = []
  for (let el of form.querySelectorAll<Field>('input[name], textarea[name], select[name]')) {
    let name = el.getAttribute('name')
    if (!name || name.startsWith('_')) continue
    fields.push(el)
  }
  return fields
}

function currentValue(field: Field): string {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.checked ? field.value : ''
    }
    return field.value
  }
  return field.value
}

/**
 * The value the server last rendered. Reading the live `defaultValue` /
 * `defaultChecked` property (rather than snapshotting once on mount) keeps the
 * baseline correct when a frame navigation re-renders the panel for a different
 * row without remounting this entry.
 */
function serverValue(field: Field): string {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.defaultChecked ? field.value : ''
    }
    return field.defaultValue
  }
  if (field instanceof HTMLTextAreaElement) {
    return field.defaultValue
  }
  let option = field.querySelector('option:checked') as HTMLOptionElement | null
  let defaultOption = field.querySelector('option[defaultSelected]') as HTMLOptionElement | null
  return option ? option.value : defaultOption ? defaultOption.value : ''
}

/**
 * Guards a server-rendered form against losing unsaved edits.
 *
 * The /admin/lists inline create/edit panels are plain forms, but every way out
 * of them (sort, pagination, filter, row edit, nav link, description link) is a
 * normal navigation. Without this, a half-typed title is discarded the moment
 * the user clicks elsewhere. The entry compares each editable field against the
 * value the server last rendered and confirms before any navigation that would
 * drop the difference.
 *
 * Render it inside the form it guards (it resolves the form via closest()).
 */
export const DirtyFormGuard = clientEntry(
  import.meta.url + '#DirtyFormGuard',
  function DirtyFormGuardEntry(handle: Handle) {
    return () => (
      <span
        data-dirty-form-guard="true"
        mix={[
          hiddenStyle,
          ref((el, signal) => {
            let initialForm = el.closest('form')
            if (!initialForm) return
            let form: HTMLFormElement = initialForm

            let submitted = false
            // One-shot: the replayed navigation must not trip beforeunload a
            // second time (a full-document navigation still unloads).
            let allowUnloadOnce = false
            // The synthetic click that replays a confirmed navigation.
            let replayClick: HTMLElement | null = null
            let formAbort = new AbortController()
            signal.addEventListener('abort', () => formAbort.abort())

            let isDirty = () => {
              if (submitted) return false
              for (let field of editableFields(form)) {
                if (currentValue(field) !== serverValue(field)) return true
              }
              return false
            }

            let refresh = () => {
              allowUnloadOnce = false
              if (isDirty()) form.setAttribute('data-dirty', 'true')
              else form.removeAttribute('data-dirty')
            }

            let markSubmitted = () => {
              submitted = true
              form.removeAttribute('data-dirty')
            }

            // A frame navigation can replace the guarded form while this entry
            // stays mounted. Re-bind so the new form gets input/submit listeners
            // and the previous form's `submitted` state cannot deaden the guard.
            let bindForm = (next: HTMLFormElement) => {
              formAbort.abort()
              formAbort = new AbortController()
              form = next
              submitted = false
              allowUnloadOnce = false
              // Element-owned listeners follow the form controller signal, so a
              // rebind (or the entry's ref signal) removes the old listeners.
              form.addEventListener('input', refresh, { signal: formAbort.signal })
              form.addEventListener('change', refresh, { signal: formAbort.signal })
              form.addEventListener('submit', markSubmitted, { signal: formAbort.signal })
            }

            bindForm(form)
            // Hydration marker for e2e: a frame swap serves fresh server HTML.
            el.setAttribute('data-dirty-form-guard-ready', 'true')

            // A fresh edit (even before a swapped-in form is re-bound) retires
            // the replay's unload exemption.
            for (let type of ['input', 'change'] as const) {
              document.addEventListener(
                type,
                () => {
                  allowUnloadOnce = false
                },
                { capture: true, signal: handle.signal },
              )
            }

            /** The navigation this click would trigger, or null when it must pass. */
            let pendingNavigation = (target: HTMLElement): PendingNavigation | null => {
              if (!isDirty()) return null

              // Links inside this form (the panel's "Abbrechen") are an explicit
              // discard; the submit button is a save.
              let anchor = target.closest<HTMLAnchorElement>('a[href]')
              if (anchor) return form.contains(anchor) ? null : { kind: 'link', anchor }

              // A submit button in another form also navigates (the filter
              // bar's GET form). POST forms (row delete) run their own confirm,
              // so skip them to avoid stacking two dialogs.
              let button = target.closest<HTMLButtonElement | HTMLInputElement>(
                'button[type="submit"], input[type="submit"]',
              )
              if (!button) return null
              let otherForm = button.closest('form')
              if (!otherForm || otherForm === form) return null
              if ((otherForm.getAttribute('method') || 'get').toLowerCase() === 'post') return null
              return { kind: 'form', form: otherForm, submitter: button }
            }

            /** Replay the navigation the user confirmed, guard disarmed once. */
            let replay = (nav: PendingNavigation) => {
              allowUnloadOnce = true
              form.removeAttribute('data-dirty')
              if (nav.kind === 'link') {
                // A real click keeps frame targeting and the anchor's own
                // target/download semantics; assign only when the node vanished.
                if (nav.anchor.isConnected) {
                  replayClick = nav.anchor
                  nav.anchor.click()
                  replayClick = null
                } else if (nav.anchor.href) {
                  window.location.assign(nav.anchor.href)
                }
                return
              }
              if (nav.form.isConnected) nav.form.requestSubmit(nav.submitter)
            }

            document.addEventListener(
              'click',
              (event) => {
                // A frame swap can leave this entry's span detached; the new
                // panel's guard owns that form.
                if (!el.isConnected) return
                let current = el.closest('form')
                if (!current) return
                if (current !== form) bindForm(current)

                let target = event.target as HTMLElement | null
                if (!target) return
                if (replayClick) {
                  if (target === replayClick || replayClick.contains(target)) {
                    replayClick = null
                    return
                  }
                }
                allowUnloadOnce = false

                let nav = pendingNavigation(target)
                if (!nav) return

                // Prefer the page's styled dialog. `null` means no
                // <ConfirmDelete> host is mounted (headless/unit renders), so
                // the synchronous prompt keeps the original click flowing.
                let decision = requestConfirmDecision({
                  message: DISCARD_MESSAGE,
                  title: 'Änderungen verwerfen?',
                  confirmLabel: 'Verwerfen',
                  tone: 'danger',
                })

                if (!decision) {
                  if (!confirm(DISCARD_MESSAGE)) {
                    event.preventDefault()
                    event.stopPropagation()
                  }
                  return
                }

                // The dialog decides asynchronously; the original navigation
                // must not start until it accepts.
                event.preventDefault()
                event.stopPropagation()
                void decision.then((accepted) => {
                  if (accepted) replay(nav)
                })
              },
              { capture: true, signal: handle.signal },
            )

            window.addEventListener(
              'beforeunload',
              (event) => {
                if (allowUnloadOnce) {
                  allowUnloadOnce = false
                  return
                }
                if (!isDirty()) return
                event.preventDefault()
                event.returnValue = ''
              },
              { signal: handle.signal },
            )
          }),
        ]}
      />
    )
  },
)
