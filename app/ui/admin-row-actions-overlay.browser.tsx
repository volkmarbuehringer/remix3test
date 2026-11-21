import { clientEntry, css, ref } from 'remix/component'

const TRIGGER_SELECTOR = '[data-row-actions-trigger]'
const CLUSTER_SELECTOR = '[data-row-actions]'
const ROW_OPEN_ATTRIBUTE = 'data-row-actions-open'
/** Presence marker for e2e: listeners only attach after this entry hydrates. */
const READY_ATTRIBUTE = 'data-admin-row-actions-ready'

type OpenActions = {
  cluster: HTMLElement
  row: HTMLElement
  trigger: HTMLButtonElement
}

/**
 * Persistent-kebab controller for the shared admin grids.
 *
 * Hover/focus reveal is CSS-only. This entry adds the click/keyboard behavior:
 * the kebab pins the same action cluster open, moves focus into it, closes it on
 * Escape or an outside pointer press, and restores focus to the trigger.
 */
export const AdminRowActionsOverlay = clientEntry(
  import.meta.url + '#AdminRowActionsOverlay',
  function AdminRowActionsOverlay() {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((element, signal) => {
            if (typeof document === 'undefined') return

            let open: OpenActions | null = null

            function close(restoreFocus: boolean) {
              let current = open
              if (!current) return
              open = null
              current.row.removeAttribute(ROW_OPEN_ATTRIBUTE)
              current.trigger.setAttribute('aria-expanded', 'false')
              if (restoreFocus && current.trigger.isConnected) current.trigger.focus()
            }

            function isFocusable(candidate: HTMLElement): boolean {
              if (candidate.hasAttribute('disabled') || candidate.tabIndex < 0) return false
              let style = getComputedStyle(candidate)
              return style.display !== 'none' && style.visibility !== 'hidden'
            }

            function openActions(trigger: HTMLButtonElement) {
              close(false)
              let row = trigger.closest<HTMLElement>('[data-row-id], tr')
              let cluster = row?.querySelector<HTMLElement>(CLUSTER_SELECTOR)
              if (!row || !cluster) return

              open = { cluster, row, trigger }
              row.setAttribute(ROW_OPEN_ATTRIBUTE, '')
              trigger.setAttribute('aria-expanded', 'true')
              // Keyboard activation should land on the first real action, not
              // make the user tab through the row again.
              let firstAction = [...cluster.querySelectorAll<HTMLElement>('a[href], button')].find(
                isFocusable,
              )
              firstAction?.focus()
            }

            let listeners = new AbortController()

            document.addEventListener(
              'click',
              (event) => {
                let target = event.target
                if (!(target instanceof Element)) return
                let trigger = target.closest<HTMLButtonElement>(TRIGGER_SELECTOR)
                if (!trigger) return

                event.preventDefault()
                if (open?.trigger === trigger) {
                  close(true)
                  return
                }
                openActions(trigger)
              },
              { signal: listeners.signal },
            )

            document.addEventListener(
              'pointerdown',
              (event) => {
                if (!open) return
                let target = event.target
                if (target instanceof Element && open.row.contains(target)) return
                close(false)
              },
              { signal: listeners.signal },
            )

            document.addEventListener(
              'keydown',
              (event) => {
                if (event.key !== 'Escape' || !open) return
                event.preventDefault()
                close(true)
              },
              { signal: listeners.signal },
            )

            signal.addEventListener(
              'abort',
              () => {
                close(false)
                listeners.abort()
              },
              { once: true },
            )

            // Tests must not click the server-rendered trigger in the hydration
            // gap, or the click is a silent no-op.
            element.setAttribute(READY_ATTRIBUTE, 'true')
          }),
        ]}
      />
    )
  },
)
