import { clientEntry, type Handle } from 'remix/ui'
import { lockScroll } from 'remix/ui/scroll-lock'

export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(handle: Handle) {
    let initialized = false
    let previousFocus: HTMLElement | null = null
    let unlockScroll: (() => void) | null = null

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        let drawer = document.getElementById('nav-drawer')
        let btn = document.getElementById('nav-toggle')
        if (!drawer || !btn) return

        btn.addEventListener('click', () => toggle())

        drawer.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close()
        })

        drawer.addEventListener('click', () => close())

        function toggle() {
          let isOpen = drawer!.classList.toggle('is-open')
          btn!.setAttribute('aria-expanded', String(isOpen))
          if (isOpen) {
            if (unlockScroll) unlockScroll()
            unlockScroll = lockScroll()
            previousFocus = document.activeElement as HTMLElement
            let closeBtn = document.getElementById('nav-close')
            if (closeBtn) closeBtn.focus()
          } else {
            if (unlockScroll) unlockScroll()
            unlockScroll = null
            if (previousFocus) {
              previousFocus.focus()
              previousFocus = null
            }
          }
        }

        function close() {
          if (drawer!.classList.contains('is-open')) toggle()
        }
      }

      return null
    }
  },
)
