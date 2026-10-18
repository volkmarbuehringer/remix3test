import { clientEntry, css, ref, type Handle } from 'remix/component'

const TRIGGER_SELECTOR = '[data-list-menu-button]'
const MENU_SELECTOR = '[data-list-menu]'

type OpenMenu = {
  trigger: HTMLButtonElement
  menu: HTMLElement
}

/**
 * Sidebar row action menu controller.
 *
 * The sidebar markup is server-rendered and spliced in by the lists frame, so
 * open/close state lives in the DOM (data-list-menu-open + aria-expanded)
 * instead of component state. One trigger per row replaces the old hover-only
 * action cluster: the cluster overlaid the count badge, clipped the row name,
 * and left every action button in the tab order even while invisible.
 */
export const ListsRowActions = clientEntry(
  import.meta.url + '#ListsRowActions',
  function ListsRowActions(handle: Handle) {
    let controllers: AbortController[] = []
    let open: OpenMenu | null = null

    function close(restoreFocus: boolean) {
      let current = open
      if (!current) return
      open = null
      current.menu.removeAttribute('data-list-menu-open')
      current.trigger.setAttribute('aria-expanded', 'false')
      if (restoreFocus) current.trigger.focus()
    }

    function init() {
      for (let ac of controllers) ac.abort()
      controllers = []
      // A frame reload replaces the sidebar rows; drop any transient state from
      // the previous render instead of leaving a menu open on a detached row.
      open = null
      for (let menu of Array.from(
        document.querySelectorAll<HTMLElement>(`${MENU_SELECTOR}[data-list-menu-open]`),
      )) {
        menu.removeAttribute('data-list-menu-open')
      }
      for (let trigger of Array.from(document.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR))) {
        trigger.setAttribute('aria-expanded', 'false')
      }

      let rows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
      if (rows.length === 0) return

      let ac = new AbortController()
      controllers.push(ac)

      for (let row of rows) {
        let trigger = row.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR)
        let menu = row.querySelector<HTMLElement>(MENU_SELECTOR)
        if (!trigger || !menu) continue

        trigger.addEventListener(
          'click',
          () => {
            if (open?.menu === menu) {
              close(false)
              return
            }
            // Opening another row's menu closes the previous one without
            // stealing focus from the trigger the user just activated.
            close(false)
            open = { trigger, menu }
            menu.setAttribute('data-list-menu-open', '')
            trigger.setAttribute('aria-expanded', 'true')
            // Land keyboard users on an action instead of making them tab
            // through the row again.
            menu.querySelector<HTMLButtonElement>('button')?.focus()
          },
          { signal: ac.signal },
        )
      }

      if (typeof document === 'undefined') return

      document.addEventListener(
        'pointerdown',
        (e) => {
          if (!open) return
          let target = e.target
          if (
            target instanceof Element &&
            (target.closest(TRIGGER_SELECTOR) || target.closest(MENU_SELECTOR))
          ) {
            return
          }
          close(false)
        },
        { capture: true, signal: ac.signal },
      )

      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key !== 'Escape' || !open) return
          close(true)
        },
        { signal: ac.signal },
      )

      // Close when an action is chosen. Capture phase is required: the rename
      // handler stops propagation in its own document-capture listener, which
      // would otherwise hide this click from a bubble-phase handler. Closing
      // does not steal focus from the rename input or the confirm dialog; the
      // queued fallback only fires when focus fell back to <body>.
      document.addEventListener(
        'click',
        (e) => {
          let current = open
          if (!current) return
          let target = e.target
          if (!(target instanceof Element) || !target.closest(MENU_SELECTOR)) return
          let { trigger, menu } = current
          close(false)
          // queueTask is drained by a component update, and this entry only
          // mutates DOM attributes while a menu is open — schedule the update
          // so the focus fallback actually runs after the menu is hidden.
          void handle.update()
          handle.queueTask(() => {
            if (!trigger.isConnected) return
            let active = document.activeElement
            if (active === null || active === document.body || menu.contains(active)) {
              trigger.focus()
            }
          })
        },
        { capture: true, signal: ac.signal },
      )
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref(() => {
            if (typeof document === 'undefined') return
            init()
            handle.frame.addEventListener('reloadComplete', init, {
              signal: handle.signal,
            })
          }),
        ]}
      />
    )
  },
)
