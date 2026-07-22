import { clientEntry, type Handle } from 'remix/ui'

const COOKIE_META = 'path=/; max-age=31536000; SameSite=Lax'

export const ThemeToggle = clientEntry(
  import.meta.url + '#ThemeToggle',
  function ThemeToggleEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('#theme-toggle')
          if (!btn) return

          let html = document.documentElement
          let isDark = html.getAttribute('data-theme') === 'dark'
          if (isDark) {
            html.removeAttribute('data-theme')
            localStorage.setItem('theme', 'light')
            document.cookie = `theme=light; ${COOKIE_META}`
          } else {
            html.setAttribute('data-theme', 'dark')
            localStorage.setItem('theme', 'dark')
            document.cookie = `theme=dark; ${COOKIE_META}`
          }
        })
      }

      return null
    }
  },
)
