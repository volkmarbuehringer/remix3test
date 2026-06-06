import { clientEntry, type Handle } from 'remix/ui'

const eyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`

const eyeOffSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

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
          btn.innerHTML = isPassword ? eyeOffSvg : eyeSvg
          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password')
        })
      }

      return null
    }
  },
)
