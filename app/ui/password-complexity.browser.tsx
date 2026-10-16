import { clientEntry, css, ref, type Handle } from 'remix/component'

import { theme } from './theme/theme.ts'

/**
 * Live password-complexity checklist, rendered under a password input.
 *
 * Replaces the former inline `<script>` (`passwordComplexityScript`): the
 * checklist is now component-owned DOM (one hydrated container per password
 * form) instead of a document-wide `input` listener rewriting `innerHTML`.
 * The rules and ✓/○ marks are built and updated with DOM APIs + `textContent`,
 * never HTML.
 *
 * The checklist container is a sibling of the password input (both live in the
 * form's `<label>`), so its input events do not bubble through the container
 * and `on('input')` on the container cannot see them. Instead the `ref` binds
 * a form-scoped `input` listener (the common ancestor, replacing the old
 * document-level listener) whose lifetime follows the container's signal —
 * removed when the component is removed, no module-scoped guard.
 *
 * Progressive enhancement preserved: the container server-renders empty and
 * the rules only appear on the first input event.
 */

interface PasswordComplexityChecklistProps {
  /** The `name` attribute of the password input to watch
   *  (e.g. "password" on the register form, "newPassword" on the settings
   *  form). Compared against `event.target.name`, so any string is safe —
   *  the old identifier guard existed only because the name was interpolated
   *  into a script string. */
  fieldName: string
}

const MET_COLOR = '#16a34a'
const UNMET_COLOR = '#6b7280'

const CRITERIA: [label: string, met: (value: string) => boolean][] = [
  ['Mindestens 10 Zeichen', (v) => v.length >= 10],
  ['Mindestens eine Zahl (0-9)', (v) => /[0-9]/.test(v)],
  ['Mindestens ein Sonderzeichen', (v) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]/.test(v)],
]

export const PasswordComplexityChecklist = clientEntry(
  import.meta.url + '#PasswordComplexityChecklist',
  function PasswordComplexityChecklist(handle: Handle<PasswordComplexityChecklistProps>) {
    let container: HTMLElement | undefined
    let rows: HTMLSpanElement[] = []

    function ensureRows(): void {
      if (rows.length > 0 || !container) return
      for (let i = 0; i < CRITERIA.length; i++) {
        let row = document.createElement('span')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.gap = '4px'
        row.style.fontSize = '12px'
        container.append(row)
        rows.push(row)
      }
    }

    function renderRules(value: string): void {
      if (!container) return
      ensureRows()
      for (let i = 0; i < CRITERIA.length; i++) {
        let [label, met] = CRITERIA[i]!
        let row = rows[i]!
        let isMet = met(value)
        row.style.color = isMet ? MET_COLOR : UNMET_COLOR
        row.textContent = (isMet ? '✓' : '○') + ' ' + label
      }
    }

    return () => (
      <div
        data-pw-complexity
        mix={[
          checklistCss,
          ref((node, signal) => {
            container = node as HTMLElement

            // Input events from the watched password field bubble to the form
            // (the old script listened on document; the form is the narrowest
            // common ancestor). The listener dies with the container.
            let form = container.closest('form')
            form?.addEventListener(
              'input',
              (event) => {
                // Only the watched password field refreshes the checklist;
                // other fields' bubbling input events are ignored.
                let target = event.target as HTMLInputElement | null
                if (!target || target.name !== handle.props.fieldName) return
                renderRules(target.value)
              },
              { signal },
            )
          }),
        ]}
      />
    )
  },
)

// ── Styles (moved from app/actions/auth/pages.tsx with the markup) ──

const checklistCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginTop: theme.space.xs,
})
