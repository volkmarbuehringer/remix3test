import { clientEntry, type Handle } from 'remix/ui'

export const ShowcaseDropdown = clientEntry(
  import.meta.url + '#ShowcaseDropdown',
  function ShowcaseDropdownEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        function toggle(forceOpen?: boolean) {
          let btn = document.getElementById('showcase-dropdown-btn')
          let menu = document.getElementById('showcase-dropdown-menu')
          if (!btn || !menu) return
          let currentlyOpen = menu.classList.contains('is-open')
          let willOpen = forceOpen !== undefined ? forceOpen : !currentlyOpen
          menu.classList.toggle('is-open', willOpen)
          btn.setAttribute('aria-expanded', String(willOpen))
        }

        document.addEventListener('click', (e) => {
          let btn = document.getElementById('showcase-dropdown-btn')
          let menu = document.getElementById('showcase-dropdown-menu')
          if (!btn || !menu) return

          let target = e.target as HTMLElement
          if (btn.contains(target)) {
            e.stopPropagation()
            toggle()
          } else if (!menu.contains(target)) {
            toggle(false)
          }
        })

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            toggle(false)
          }
        })
      }

      return null
    }
  },
)
