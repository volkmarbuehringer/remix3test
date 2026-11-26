import { clientEntry, css, on, type Handle } from 'remix/component'
import { spring } from '@remix-run/ui/animation'
import * as dialog from '@remix-run/ui/dialog'

import { theme } from './theme/theme.ts'
import button from './theme/button.ts'

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
 * Ask the shell-owned ConfirmDelete instance to confirm an action, so non-click
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

const hiddenMarker = css({ display: 'none' })

const backdropStyle = css({
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  opacity: 0,
  transition: 'opacity 120ms ease-out',
  '&[data-state="open"]': {
    opacity: 1,
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const surfaceStyle = css({
  inset: 0,
  width: 'min(420px, calc(100vw - 2rem))',
  height: 'max-content',
  maxHeight: 'calc(100dvh - 2rem)',
  margin: 'auto',
  overflow: 'auto',
  boxSizing: 'border-box',
  background: theme.surface.lvl0,
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.md,
  padding: theme.space.lg,
  opacity: 0,
  transform: 'scale(0.97) translateY(4px)',
  transition: `opacity 120ms ease-out, transform ${spring('snappy')}`,
  '&[data-state="open"]': {
    opacity: 1,
    transform: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    transform: 'none',
  },
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
 * The shell mounts one instance (next to ToastHost) so every page shares the
 * same dialog, it survives frame swaps, and the vendor overlay stack orders it
 * with menus, popovers and nested dialogs.
 */
export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    let pending: PendingConfirm | null = null
    let open = false
    let decision: 'confirm' | 'cancel' | null = null

    // Schedule browser-only setup after the client commit (guide 05
    // §"DOM references, global events, and cleanup"): setup also runs during
    // SSR, and the queued task is a no-op there.
    handle.queueTask(() => {
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
          start({
            message: form.getAttribute('data-confirm') || 'Wirklich löschen?',
            title: form.getAttribute('data-confirm-title') || 'Löschen bestätigen',
            confirmLabel: form.getAttribute('data-confirm-label') || 'Löschen',
            tone: form.getAttribute('data-confirm-tone') === 'primary' ? 'primary' : 'danger',
            // requestSubmit (not submit) dispatches a submit event, so the frame
            // runtime still performs the DELETE navigation.
            onConfirm: () => form.requestSubmit(btn),
          })
        },
        { capture: true, signal: handle.signal },
      )

      document.addEventListener(
        CONFIRM_EVENT,
        (event) => {
          let detail = (event as CustomEvent<ConfirmRequestDetail>).detail
          if (!detail) return
          event.preventDefault()
          start({
            message: detail.message,
            title: detail.title || 'Löschen bestätigen',
            confirmLabel: detail.confirmLabel || 'Löschen',
            tone: detail.tone || 'danger',
            onConfirm: detail.onConfirm,
            onCancel: detail.onCancel,
          })
        },
        { signal: handle.signal },
      )
    })

    function start(detail: PendingConfirm) {
      // A later confirmation supersedes one still exiting; release any caller
      // that was waiting on the old decision, but never re-run a settled one.
      if (pending && decision === null) pending.onCancel?.()
      pending = detail
      decision = null
      open = true
      void handle.update()
    }

    function cancel() {
      let current = pending
      if (!current || decision !== null) return
      decision = 'cancel'
      open = false
      void handle.update()
      current.onCancel?.()
    }

    function accept() {
      let current = pending
      if (!current || decision !== null) return
      decision = 'confirm'
      open = false
      void handle.update()
      current.onConfirm()
    }

    function finishClose() {
      pending = null
      decision = null
      open = false
      void handle.update()
    }

    return () => {
      // The idle marker tells callers (and e2e) that the dialog is hydrated and
      // can take over a confirmation instead of the native window.confirm.
      if (!pending) return <div data-confirm-ready="true" mix={hiddenMarker} />
      let current = pending
      return (
        <dialog.Context
          open={open}
          onOpenChange={(next) => {
            if (!next) cancel()
          }}
          onOpenChangeComplete={(next) => {
            if (!next) finishClose()
          }}
        >
          <dialog.Portal>
            <div data-confirm-overlay="true" mix={[backdropStyle, dialog.backdrop()]} />
            <dialog.SurfaceContext>
              <div
                role="alertdialog"
                data-confirm-dialog="true"
                aria-labelledby="confirm-delete-title"
                aria-describedby="confirm-delete-message"
                mix={[surfaceStyle, dialog.surface()]}
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
                    mix={[button({ tone: 'secondary' }), on('click', cancel)]}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    data-confirm-accept="true"
                    mix={[
                      button({ tone: current.tone }),
                      dialog.focusOnShow(),
                      on('click', accept),
                    ]}
                  >
                    {current.confirmLabel}
                  </button>
                </div>
              </div>
            </dialog.SurfaceContext>
          </dialog.Portal>
        </dialog.Context>
      )
    }
  },
)
