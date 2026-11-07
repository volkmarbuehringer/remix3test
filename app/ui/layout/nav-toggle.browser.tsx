import { clientEntry, type Handle } from 'remix/component'
import { lockScroll } from '../../utils/scroll-lock.ts'

export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(_handle: Handle) {
    let previousFocus: HTMLElement | null = null
    let unlockScroll: (() => void) | null = null
    // Bind once per element, but re-check on every render: a layout re-render
    // can replace #nav-toggle or #nav-drawer while this entry instance stays
    // alive, and the new nodes need listeners too.
    let boundButtons = new WeakSet<HTMLElement>()
    let boundDrawers = new WeakSet<HTMLElement>()

    function toggle() {
      let drawer = document.getElementById('nav-drawer')
      let btn = document.getElementById('nav-toggle')
      if (!drawer || !btn) return

      let isOpen = drawer.classList.toggle('is-open')
      btn.setAttribute('aria-expanded', String(isOpen))
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
      let drawer = document.getElementById('nav-drawer')
      if (drawer?.classList.contains('is-open')) toggle()
    }

    return () => {
      if (typeof document === 'undefined') return null

      let drawer = document.getElementById('nav-drawer')
      let btn = document.getElementById('nav-toggle')
      if (!drawer || !btn) return null

      if (!boundButtons.has(btn)) {
        btn.addEventListener('click', toggle)
        boundButtons.add(btn)
      }

      if (!boundDrawers.has(drawer)) {
        drawer.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') close()
        })
        drawer.addEventListener('click', () => close())
        boundDrawers.add(drawer)
      }

      // Hydration marker for e2e tests: clicking before this attribute exists
      // is a no-op because the listener is not attached yet.
      btn.setAttribute('data-nav-toggle-ready', 'true')
      // A parent render may have patched the SSR `aria-expanded="false"` back
      // onto the button while the drawer kept its imperative `is-open` class.
      btn.setAttribute('aria-expanded', String(drawer.classList.contains('is-open')))

      return null
    }
  },
)
