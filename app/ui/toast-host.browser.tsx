import { clientEntry, css, ref, type Handle } from 'remix/component'

import { theme } from './theme/theme.ts'
import { OverlayPortal } from './overlay-root.tsx'
import { TOAST_EVENT, type ToastRequest, type ToastTone } from './toast.ts'

const TOAST_DURATION = 3500
const TOAST_FADE_DURATION = 300

interface ToastItem extends ToastRequest {
  id: number
  visible: boolean
  leaving: boolean
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
  pointerEvents: 'auto',
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
    let timers = new Set<ReturnType<typeof setTimeout>>()
    let frames = new Set<number>()

    function later(fn: () => void, delay: number) {
      let timer = setTimeout(() => {
        timers.delete(timer)
        fn()
      }, delay)
      timers.add(timer)
    }

    function startExit(toast: ToastItem) {
      if (toast.leaving) return
      toast.leaving = true
      void handle.update()
      later(() => {
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
      }
      toasts.push(toast)
      void handle.update()

      // Commit the hidden first frame before flipping to visible, so the
      // opacity/transform transition actually runs (the old imperative toast
      // used the same requestAnimationFrame step).
      let frame = requestAnimationFrame(() => {
        frames.delete(frame)
        if (toast.leaving) return
        toast.visible = true
        void handle.update()
      })
      frames.add(frame)

      later(() => startExit(toast), TOAST_DURATION)
    }

    handle.signal.addEventListener('abort', () => {
      for (let timer of timers) clearTimeout(timer)
      timers.clear()
      for (let frame of frames) cancelAnimationFrame(frame)
      frames.clear()
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
