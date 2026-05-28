import { clientEntry, type Handle } from 'remix/ui'

export const ScrollToTop = clientEntry(
  import.meta.url + '#ScrollToTop',
  function ScrollToTopEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            let container = document.getElementById('messages-container')
            if (container) container.scrollTop = 0
          })
        })
      }

      return null
    }
  },
)
