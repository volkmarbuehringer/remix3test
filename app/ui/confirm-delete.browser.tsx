import { clientEntry, css, on, ref, type Handle } from 'remix/component'
import { theme } from './theme/theme.ts'
import button from './theme/button.ts'

interface PendingConfirm {
  message: string
  /** Runs only when the user accepts. */
  onConfirm: () => void
}

const CONFIRM_EVENT = 'app:confirm-request'

export interface ConfirmRequestDetail {
  message: string
  onConfirm: () => void
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

const overlayStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.space.lg,
  background: 'rgba(0, 0, 0, 0.45)',
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
          pending = {
            message: form.getAttribute('data-confirm') || 'Wirklich löschen?',
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
          pending = { message: detail.message, onConfirm: detail.onConfirm }
          void handle.update()
        },
        { signal: handle.signal },
      )
    }

    function close() {
      pending = null
      void handle.update()
    }

    function accept() {
      let current = pending
      pending = null
      void handle.update()
      current?.onConfirm()
    }

    return () => {
      if (!pending) return <div mix={css({ display: 'none' })} />
      let current = pending
      return (
        <div
          data-confirm-overlay="true"
          mix={[
            overlayStyle,
            on('click', (event) => {
              if (event.target === event.currentTarget) close()
            }),
          ]}
        >
          <div
            data-confirm-dialog="true"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-message"
            mix={[
              dialogStyle,
              on('keydown', (event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  close()
                }
              }),
            ]}
          >
            <h2 id="confirm-delete-title" mix={titleStyle}>
              Löschen bestätigen
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
                mix={[button({ tone: 'danger' }), on('click', accept), ref((el) => el?.focus())]}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )
    }
  },
)
