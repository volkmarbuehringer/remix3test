import { clientEntry, type Handle } from 'remix/ui'

export const FormLoadingState = clientEntry(
  import.meta.url + '#FormLoadingState',
  function FormLoadingEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        document.addEventListener('submit', (e) => {
          let form = (e.target as HTMLElement).closest(
            '#chat-form, #agent-form',
          ) as HTMLFormElement | null
          if (!form) return

          let btn = form.querySelector(
            'button[type="submit"]',
          ) as HTMLButtonElement | null
          if (!btn || btn.disabled) return

          btn.disabled = true
          btn.classList.add('is-loading')
        })

        // Re-enable disabled buttons when the page is shown again.
        // Handles the case where a form submission fails (e.g. network error)
        // or the browser serves a bfcache copy without a full navigation.
        window.addEventListener('pageshow', () => {
          for (let btn of document.querySelectorAll('#chat-form button[type="submit"], #agent-form button[type="submit"]')) {
            (btn as HTMLButtonElement).disabled = false
            btn.classList.remove('is-loading')
          }
        })
      }

      return null
    }
  },
)
