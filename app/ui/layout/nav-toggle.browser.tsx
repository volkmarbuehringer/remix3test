import { clientEntry, type Handle } from 'remix/component'
import { lockScroll } from '../../utils/scroll-lock.ts'

/**
 * Mobile navigation drawer.
 *
 * `<dialog>` owns the top layer, inert background, Escape (`cancel`), focus
 * containment, and focus restore. This entry adds only the page scroll lock and
 * the trigger's `aria-expanded`. Listeners are delegated by id so a re-render
 * replacing either node needs no rebinding; `handle.signal` removes them.
 */
export const NavToggle = clientEntry(
  import.meta.url + '#NavToggle',
  function NavToggleEntry(handle: Handle) {
    let unlockScroll: (() => void) | null = null

    function getDrawer(): HTMLDialogElement | null {
      let drawer = document.getElementById('nav-drawer')
      return drawer instanceof HTMLDialogElement ? drawer : null
    }

    function setExpanded(isOpen: boolean) {
      document.getElementById('nav-toggle')?.setAttribute('aria-expanded', String(isOpen))
    }

    function open() {
      let drawer = getDrawer()
      if (!drawer || drawer.open) return
      drawer.showModal()
      setExpanded(true)
      unlockScroll = lockScroll()
      document.getElementById('nav-close')?.focus()
    }

    function cleanup() {
      setExpanded(false)
      unlockScroll?.()
      unlockScroll = null
      // The hamburger is the only opener. Focus the live node: native restore
      // would target the pre-showModal trigger, which a re-render may replace.
      document.getElementById('nav-toggle')?.focus()
    }

    function close() {
      let drawer = getDrawer()
      if (!drawer?.open) return
      drawer.close()
      // The platform queues `close`; clean up now so a close click unlocks
      // immediately. The dialog-event listener repeats this idempotently.
      cleanup()
    }

    /** `cancel` (Escape) and `close` both target the drawer; neither bubbles. */
    function onDialogEvent(event: Event) {
      if (event.target instanceof Element && event.target.id === 'nav-drawer') cleanup()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (event) => {
          let target = event.target
          if (!(target instanceof Element)) return
          if (target.closest('#nav-toggle')) {
            let drawer = getDrawer()
            if (drawer) drawer.open ? close() : open()
          } else if (target.closest('#nav-drawer')) {
            // Backdrop, close button, and destination links all dismiss.
            close()
          }
        },
        { signal: handle.signal },
      )
      // Neither `cancel` (Escape) nor `close` bubbles, so both are observed in
      // the capture phase. `cancel` runs before the platform closes, so the
      // trigger and scroll lock do not lag; never preventDefault.
      for (let type of ['cancel', 'close'] as const) {
        document.addEventListener(type, onDialogEvent, {
          signal: handle.signal,
          capture: true,
        })
      }
    }

    return () => {
      if (typeof document === 'undefined') return null

      let drawer = getDrawer()
      let btn = document.getElementById('nav-toggle')
      // A re-render can replace the open dialog with a closed one; the old
      // modal is gone and cannot emit `close`, so release the lock here.
      if (unlockScroll && !drawer?.open) cleanup()
      if (!drawer || !btn) return null

      // Hydration marker for e2e: clicking before listeners attach is a no-op.
      if (btn.getAttribute('data-nav-toggle-ready') !== 'true') {
        btn.setAttribute('data-nav-toggle-ready', 'true')
      }
      return null
    }
  },
)
