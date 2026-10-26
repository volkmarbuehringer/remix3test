import { clientEntry, css, on, ref, type Handle } from 'remix/component'
import { animateEntrance, animateExit, spring } from '@remix-run/ui/animation'
import { theme } from './theme/theme.ts'
import button from './theme/button.ts'
import { entrance, exit } from '../utils/motion.ts'

interface PendingConfirm {
  message: string
  title: string
  confirmLabel: string
  tone: 'danger' | 'primary'
  /** Runs only when the user accepts. */
  onConfirm: () => void
  /** Runs when the user cancels/dismisses. Lets an awaited decision unblock. */
  onCancel?: (() => void) | undefined
}

const CONFIRM_EVENT = 'app:confirm-request'

interface ConfirmRequestOptions {
  message: string
  /** Defaults to "Löschen bestätigen". */
  title?: string
  /** Defaults to "Löschen". */
  confirmLabel?: string
  /** Defaults to the danger tone (destructive action). */
  tone?: 'danger' | 'primary'
}

interface ConfirmRequestDetail extends ConfirmRequestOptions {
  onConfirm: () => void
  onCancel?: (() => void) | undefined
}

/**
 * Ask the page's ConfirmDelete instance to confirm an action, so non-click
 * triggers (context-menu deletes, bulk buttons) share the same dialog. Returns
 * true once a dialog has taken over — the callback then runs only if accepted.
 * Returns false when no dialog is mounted, letting the caller fall back to
 * window.confirm (keeps headless/unit paths working).
 */
export function requestConfirm(detail: ConfirmRequestDetail): boolean {
  if (typeof document === 'undefined') return false
  let event = new CustomEvent<ConfirmRequestDetail>(CONFIRM_EVENT, {
    detail,
    cancelable: true,
  })
  document.dispatchEvent(event)
  return event.defaultPrevented
}

/**
 * Promise-returning variant for flows that must await the decision before
 * issuing their request (e.g. the list merge drag). Returns null when no
 * dialog is mounted so callers can fall back to window.confirm.
 */
export function requestConfirmDecision(detail: ConfirmRequestOptions): Promise<boolean> | null {
  if (typeof document === 'undefined') return null
  let resolve!: (accepted: boolean) => void
  let decision = new Promise<boolean>((res) => {
    resolve = res
  })
  let event = new CustomEvent<ConfirmRequestDetail>(CONFIRM_EVENT, {
    detail: {
      ...detail,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    },
    cancelable: true,
  })
  document.dispatchEvent(event)
  return event.defaultPrevented ? decision : null
}

const overlayStyle = css({
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: theme.space.lg,
  border: 0,
  background: 'rgba(0, 0, 0, 0.45)',
  color: 'inherit',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const dialogStyle = css({
  width: '100%',
  maxWidth: '420px',
  background: theme.surface.lvl0,
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.md,
  padding: theme.space.lg,
})

// Entrance/exit for the overlay + dialog (guides.remix.run/animation).
// Keys on the conditional elements let the runtime track enter/exit identity.
const overlayEntrance = animateEntrance(entrance({ opacity: 0, ...spring('snappy') }))
const overlayExit = animateExit(exit({ opacity: 0, ...spring('snappy') }))
const dialogEntrance = animateEntrance(
  entrance({ opacity: 0, transform: 'scale(0.97) translateY(4px)', ...spring('snappy') }),
)
const dialogExit = animateExit(
  exit({ opacity: 0, transform: 'scale(0.97) translateY(4px)', ...spring('snappy') }),
)

const titleStyle = css({
  margin: 0,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const messageStyle = css({
  margin: theme.space.sm + ' 0 0',
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

const actionsStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
})

/**
 * Intercepts destructive form submits (form[data-confirm]) and asks through an
 * in-app dialog instead of the blocking, unstyled window.confirm. The click is
 * always prevented; confirming re-submits the original form with requestSubmit,
 * which still fires a submit event so the frame runtime intercepts it normally.
 *
 * The dialog is a native modal `<dialog>` opened with showModal(), so focus is
 * contained, the page behind it is inert, and Escape arrives as `cancel`.
 *
 * Rendered once per grid, so the delegated listeners are registered once.
 */
export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    let pending: PendingConfirm | null = null

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (event) => {
          let target = event.target as HTMLElement
          let btn = target.closest('button[type="submit"]') as HTMLButtonElement | null
          if (!btn) return
          let form = btn.closest('form[data-confirm]') as HTMLFormElement | null
          if (!form) return
          event.preventDefault()
          event.stopPropagation()
          pending?.onCancel?.()
          pending = {
            message: form.getAttribute('data-confirm') || 'Wirklich löschen?',
            title: 'Löschen bestätigen',
            confirmLabel: 'Löschen',
            tone: 'danger',
            // requestSubmit (not submit) dispatches a submit event, so the frame
            // runtime still performs the DELETE navigation.
            onConfirm: () => form.requestSubmit(btn),
          }
          void handle.update()
        },
        { capture: true, signal: handle.signal },
      )

      document.addEventListener(
        CONFIRM_EVENT,
        (event) => {
          let detail = (event as CustomEvent<ConfirmRequestDetail>).detail
          if (!detail) return
          event.preventDefault()
          pending?.onCancel?.()
          pending = {
            message: detail.message,
            title: detail.title || 'Löschen bestätigen',
            confirmLabel: detail.confirmLabel || 'Löschen',
            tone: detail.tone || 'danger',
            onConfirm: detail.onConfirm,
            onCancel: detail.onCancel,
          }
          void handle.update()
        },
        { signal: handle.signal },
      )
    }

    let dialogEl: HTMLDialogElement | null = null
    let removalObserver: MutationObserver | null = null
    let returnFocusTo: HTMLElement | null = null

    /**
     * Use a native modal `<dialog>` for real focus containment, inertness and
     * Escape handling. `showModal()` happens on insert rather than from state,
     * and the dialog stays open while animateExit fades the retained node.
     * Closing immediately would hide it before the exit transition, so restore
     * focus manually once the retained node is disconnected — `close()` on a
     * disconnected dialog no longer restores focus.
     */
    function watchForRemoval(dialog: HTMLDialogElement) {
      if (removalObserver) return
      removalObserver = new MutationObserver(() => {
        if (dialog.isConnected) return
        removalObserver?.disconnect()
        removalObserver = null
        let target = returnFocusTo
        returnFocusTo = null
        if (dialogEl === dialog) dialogEl = null
        if (target?.isConnected) target.focus()
      })
      removalObserver.observe(document.body, { childList: true, subtree: true })
    }

    handle.signal.addEventListener('abort', () => {
      removalObserver?.disconnect()
      removalObserver = null
      returnFocusTo = null
      dialogEl = null
    })

    function dismiss(): PendingConfirm | null {
      let current = pending
      pending = null
      void handle.update()
      return current
    }

    function close() {
      dismiss()?.onCancel?.()
    }

    function accept() {
      dismiss()?.onConfirm()
    }

    return () => {
      // The idle marker tells callers (and e2e) that the dialog is hydrated and
      // can take over a confirmation instead of the native window.confirm.
      if (!pending) return <div data-confirm-ready="true" mix={css({ display: 'none' })} />
      let current = pending
      return (
        <dialog
          key="confirm-dialog"
          data-confirm-overlay="true"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          aria-describedby="confirm-delete-message"
          mix={[
            overlayStyle,
            overlayEntrance,
            overlayExit,
            ref((el) => {
              if (!el) return
              dialogEl = el
              if (!el.open) {
                let active = document.activeElement
                returnFocusTo =
                  active instanceof HTMLElement && active !== document.body ? active : null
                el.showModal()
              }
              watchForRemoval(el)
            }),
            on('cancel', (event) => {
              event.preventDefault()
              close()
            }),
            on('click', (event) => {
              if (event.target === event.currentTarget) close()
            }),
          ]}
        >
          <div
            key="confirm-card"
            data-confirm-dialog="true"
            mix={[dialogStyle, dialogEntrance, dialogExit]}
          >
            <h2 id="confirm-delete-title" mix={titleStyle}>
              {current.title}
            </h2>
            <p id="confirm-delete-message" mix={messageStyle}>
              {current.message}
            </p>
            <div mix={actionsStyle}>
              <button
                type="button"
                data-confirm-cancel="true"
                mix={[button({ tone: 'secondary' }), on('click', close)]}
              >
                Abbrechen
              </button>
              <button
                type="button"
                data-confirm-accept="true"
                autoFocus
                mix={[button({ tone: current.tone }), on('click', accept)]}
              >
                {current.confirmLabel}
              </button>
            </div>
          </div>
        </dialog>
      )
    }
  },
)
