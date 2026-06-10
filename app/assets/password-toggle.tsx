import { clientEntry, type Handle } from 'remix/ui'

export const PasswordToggle = clientEntry(
  import.meta.url + '#PasswordToggle',
  function PasswordToggleEntry(_handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('[data-toggle-pw]') as HTMLElement | null
          if (!btn) return

          let fieldName = btn.getAttribute('data-toggle-pw')
          if (!fieldName) return

          let form = btn.closest('form')
          if (!form) return

          let input = form.querySelector<HTMLInputElement>(`[name="${fieldName}"]`)
          if (!input) return

          let isPassword = input.type === 'password'
          input.type = isPassword ? 'text' : 'password'

          let useEl = btn.querySelector('use')
          if (useEl) {
            useEl.setAttribute('href', isPassword ? '#rmx-glyph-eyeOff' : '#rmx-glyph-eye')
            useEl.setAttribute('xlink:href', isPassword ? '#rmx-glyph-eyeOff' : '#rmx-glyph-eye')
          }

          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password')
        })
      }

      return null
    }
  },
)