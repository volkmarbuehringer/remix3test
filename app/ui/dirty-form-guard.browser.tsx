import { clientEntry, css, ref, type Handle } from 'remix/ui'

const hiddenStyle = css({ display: 'none' })

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

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
          ref((el) => {
            let form = el.closest('form')
            if (!form) return

            let submitted = false

            let isDirty = () => {
              if (submitted) return false
              for (let field of editableFields(form)) {
                if (currentValue(field) !== serverValue(field)) return true
              }
              return false
            }

            let refresh = () => {
              if (isDirty()) form.setAttribute('data-dirty', 'true')
              else form.removeAttribute('data-dirty')
            }

            form.addEventListener('input', refresh, { signal: handle.signal })
            form.addEventListener('change', refresh, { signal: handle.signal })

            // A submit is an intentional save: drop the guard before navigation.
            form.addEventListener(
              'submit',
              () => {
                submitted = true
                form.removeAttribute('data-dirty')
              },
              { signal: handle.signal },
            )

            let wouldDiscardEdits = (target: HTMLElement): boolean => {
              if (!isDirty()) return false

              // Links inside this form (the panel's "Abbrechen") are an explicit
              // discard; the submit button is a save.
              let anchor = target.closest('a[href]')
              if (anchor) return !form.contains(anchor)

              // A submit button in another form also navigates (the filter
              // bar's GET form). POST forms (row delete) run their own confirm,
              // so skip them to avoid stacking two dialogs.
              let button = target.closest('button[type="submit"], input[type="submit"]')
              if (!button) return false
              let otherForm = button.closest('form')
              if (!otherForm || otherForm === form) return false
              return (otherForm.getAttribute('method') || 'get').toLowerCase() !== 'post'
            }

            document.addEventListener(
              'click',
              (event) => {
                let target = event.target as HTMLElement | null
                if (!target || !wouldDiscardEdits(target)) return
                if (!confirm('Nicht gespeicherte Änderungen verwerfen?')) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              },
              { capture: true, signal: handle.signal },
            )

            window.addEventListener(
              'beforeunload',
              (event) => {
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
