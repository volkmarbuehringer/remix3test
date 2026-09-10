import { clientEntry, type Handle } from 'remix/ui'

const SIDEBAR_ID = 'sidebar-shell-nav'
const TOGGLE_ID = 'sidebar-shell-toggle'

/**
 * Wires the phone-only "Bereiche" button to the admin shell sidebar.
 *
 * The shell is a two-column grid on desktop; at <=768px the sidebar becomes a
 * drawer (CSS hides it until it gets `is-open`). Listeners are registered on
 * `document` and resolve the current elements by id on every click, so they
 * keep working across frame navigations that replace the shell DOM.
 */
export const SidebarToggle = clientEntry(
  import.meta.url + '#SidebarToggle',
  function SidebarToggleEntry(handle: Handle) {
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (event) => {
          let target = event.target as HTMLElement | null
          if (!target) return

          let sidebar = document.getElementById(SIDEBAR_ID)
          if (!sidebar) return

          let toggle = target.closest('#' + TOGGLE_ID)
          if (toggle) {
            let open = sidebar.classList.toggle('is-open')
            toggle.setAttribute('aria-expanded', String(open))
            return
          }

          // Choosing a destination collapses the open drawer so the content is
          // visible immediately.
          if (sidebar.classList.contains('is-open') && sidebar.contains(target)) {
            sidebar.classList.remove('is-open')
            document.getElementById(TOGGLE_ID)?.setAttribute('aria-expanded', 'false')
          }
        },
        { signal: handle.signal },
      )

      // Crossing the breakpoint resets the drawer so a resize doesn't inherit a
      // stale open/closed class.
      let media = window.matchMedia('(max-width: 768px)')
      media.addEventListener(
        'change',
        (event) => {
          if (event.matches) return
          let sidebar = document.getElementById(SIDEBAR_ID)
          let toggle = document.getElementById(TOGGLE_ID)
          if (!sidebar || !toggle) return
          sidebar.classList.remove('is-open')
          toggle.setAttribute('aria-expanded', 'false')
        },
        { signal: handle.signal },
      )
    }

    return () => null
  },
)
