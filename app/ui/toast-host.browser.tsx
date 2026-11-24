import { clientEntry, css, ref, type Handle } from 'remix/component'

import { theme } from './theme/theme.ts'
import { OverlayPortal } from './overlay-root.tsx'
import { TOAST_EVENT, type ToastRequest, type ToastTone } from './toast.ts'

const TOAST_DURATION = 3500
const TOAST_FADE_DURATION = 300
/** Keep only the newest messages; older ones are dropped without a fade. */
const MAX_TOASTS = 3

interface ToastItem extends ToastRequest {
  id: number
  visible: boolean
  leaving: boolean
  displayTimer: ReturnType<typeof setTimeout> | null
  exitTimer: ReturnType<typeof setTimeout> | null
  entranceFrame: number | null
}

/**
 * Hidden host marker. `data-toast-host-ready` is set only after the document
 * listener is attached, so e2e tests never dispatch into the hydration gap.
 */
const hostMarkerStyle = css({ display: 'none' })

const viewportStyle = css({
  position: 'fixed',
  top: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  pointerEvents: 'none',
})

const toastStyle = css({
  padding: `${theme.space.sm} ${theme.space.lg}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  boxShadow: theme.shadow.md,
  maxWidth: 'min(28rem, calc(100vw - 2rem))',
  boxSizing: 'border-box',
  overflowWrap: 'anywhere',
  pointerEvents: 'none',
  textAlign: 'center',
  opacity: 0,
  transform: 'translateY(-4px)',
  transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
})

const visibleToastStyle = css({
  opacity: 1,
  transform: 'translateY(0)',
})

/**
 * Fill/ink/border per tone. These are the action-danger and success theme
 * groups, not `theme.surface` (which only holds lvl0–lvl4): an earlier cast
 * resolved every tone key to undefined and toasts rendered unstyled.
 */
const toneStyles = {
  error: css({
    backgroundColor: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
    border: `1px solid ${theme.colors.action.danger.border}`,
  }),
  success: css({
    backgroundColor: theme.colors.success.background,
    color: theme.colors.success.foreground,
    border: `1px solid ${theme.colors.success.border}`,
  }),
} satisfies Record<ToastTone, unknown>

/**
 * Shell-owned toast renderer.
 *
 * Imperative callers keep the tiny `showToast()` API; it dispatches a document
 * event that this entry owns. Toasts render through `OverlayPortal`, so they
 * live in the shell overlay root (outside the page scroller, every frame, and
 * the named view-transition regions) and survive frame swaps. Mounted once by
 * `Document`, next to `FlashAnnouncer`.
 *
 * The timeout starts when the toast is accepted, matching the previous
 * imperative implementation: 3500 ms visible, then a 300 ms exit. The exit is a
 * timer, not `transitionend`, so reduced motion (where the shell disables
 * transitions) follows the same path.
 */
export const ToastHost = clientEntry(
  import.meta.url + '#ToastHost',
  function ToastHost(handle: Handle) {
    let toasts: ToastItem[] = []
    let nextId = 0

    function isLive(toast: ToastItem) {
      return toasts.includes(toast)
    }

    /** Clear only this toast's scheduled work, never another toast's. */
    function clearScheduled(toast: ToastItem) {
      if (toast.displayTimer !== null) {
        clearTimeout(toast.displayTimer)
        toast.displayTimer = null
      }
      if (toast.exitTimer !== null) {
        clearTimeout(toast.exitTimer)
        toast.exitTimer = null
      }
      if (toast.entranceFrame !== null) {
        cancelAnimationFrame(toast.entranceFrame)
        toast.entranceFrame = null
      }
    }

    function dropToast(toast: ToastItem) {
      clearScheduled(toast)
      toasts = toasts.filter((item) => item.id !== toast.id)
    }

    function startExit(toast: ToastItem) {
      if (toast.leaving || !isLive(toast)) return
      toast.leaving = true
      void handle.update()
      toast.exitTimer = setTimeout(() => {
        toast.exitTimer = null
        if (!isLive(toast)) return
        toasts = toasts.filter((item) => item.id !== toast.id)
        void handle.update()
      }, TOAST_FADE_DURATION)
    }

    function onToast(event: Event) {
      let detail = (event as CustomEvent<ToastRequest | undefined>).detail
      if (!detail?.message) return

      let toast: ToastItem = {
        id: ++nextId,
        message: detail.message,
        tone: detail.tone === 'success' ? 'success' : 'error',
        visible: false,
        leaving: false,
        displayTimer: null,
        exitTimer: null,
        entranceFrame: null,
      }
      toasts.push(toast)

      // Bound the stack at the newest messages. Dropped toasts disappear
      // immediately and their timers/frame cannot update the DOM later.
      if (toasts.length > MAX_TOASTS) {
        for (let dropped of toasts.slice(0, toasts.length - MAX_TOASTS)) dropToast(dropped)
      }
      void handle.update()

      // Commit the hidden first frame before flipping to visible, so the
      // opacity/transform transition actually runs (the old imperative toast
      // used the same requestAnimationFrame step).
      toast.entranceFrame = requestAnimationFrame(() => {
        toast.entranceFrame = null
        if (toast.leaving || !isLive(toast)) return
        toast.visible = true
        void handle.update()
      })

      toast.displayTimer = setTimeout(() => {
        toast.displayTimer = null
        startExit(toast)
      }, TOAST_DURATION)
    }

    handle.signal.addEventListener('abort', () => {
      for (let toast of toasts) clearScheduled(toast)
      toasts = []
    })

    return () => (
      <>
        <div
          data-toast-host=""
          mix={[
            hostMarkerStyle,
            ref((element, signal) => {
              if (typeof document === 'undefined') return
              document.addEventListener(TOAST_EVENT, onToast, { signal })
              element.setAttribute('data-toast-host-ready', 'true')
            }),
          ]}
        />
        {toasts.length > 0 ? (
          <OverlayPortal>
            <div id="__toast-root" mix={viewportStyle}>
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  data-toast-type={toast.tone}
                  role={toast.tone === 'error' ? 'alert' : 'status'}
                  aria-atomic="true"
                  mix={[
                    toastStyle,
                    toneStyles[toast.tone],
                    toast.visible ? visibleToastStyle : undefined,
                  ]}
                >
                  {toast.message}
                </div>
              ))}
            </div>
          </OverlayPortal>
        ) : null}
      </>
    )
  },
)
