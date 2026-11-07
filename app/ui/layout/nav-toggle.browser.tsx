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
        releaseScrollLock()
        unlockScroll = lockScroll()
        previousFocus = document.activeElement as HTMLElement
        let closeBtn = document.getElementById('nav-close')
        if (closeBtn) closeBtn.focus()
      } else {
        releaseScrollLock()
        restoreFocus()
      }
    }

    /** Release the reference-counted scroll lock, if this entry holds one. */
    function releaseScrollLock() {
      if (!unlockScroll) return
      unlockScroll()
      unlockScroll = null
    }

    /**
     * Return focus to whatever opened the drawer.
     *
     * The trigger can be replaced by a re-render while the drawer is open, and
     * focusing a detached node is a no-op that drops focus to `<body>` — so
     * fall back to the toggle button that is currently in the document.
     */
    function restoreFocus() {
      let remembered = previousFocus
      previousFocus = null
      if (!remembered) return
      let target = remembered.isConnected ? remembered : document.getElementById('nav-toggle')
      target?.focus()
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
      if (btn.getAttribute('data-nav-toggle-ready') !== 'true') {
        btn.setAttribute('data-nav-toggle-ready', 'true')
      }
      // A parent render may have patched the SSR `aria-expanded="false"` back
      // onto the button while the drawer kept its imperative `is-open` class.
      let isOpen = drawer.classList.contains('is-open')
      if (btn.getAttribute('aria-expanded') !== String(isOpen)) {
        btn.setAttribute('aria-expanded', String(isOpen))
      }

      // The drawer element can be replaced by a re-render while it is open.
      // The replacement carries no `is-open`, so the drawer is closed — but the
      // reference-counted scroll lock would stay held and the page could not
      // scroll again until a full reload.
      if (!isOpen && unlockScroll) {
        releaseScrollLock()
        previousFocus = null
        // Focus was inside the replaced drawer and is now lost to `<body>`;
        // move it to the trigger rather than leaving it on the document.
        if (document.activeElement === document.body) {
          btn.focus()
        }
      }

      return null
    }
  },
)
