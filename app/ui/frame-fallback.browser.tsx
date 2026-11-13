import { clientEntry, css, on, ref, type Handle } from 'remix/component'
import { theme } from './theme/theme.ts'

type FrameFallbackProps = {
  /** Loading copy shown immediately (and to a JS-disabled browser). */
  label: string
  /** Frame to retry; falls back to the containing frame, then the page. */
  name?: string
  /** How long to show the plain loading state before offering a retry. */
  retryAfterMs?: number
}

/**
 * Loading slot for a deferred <Frame>.
 *
 * The server keeps the fallback in place when a deferred frame fails after its
 * first chunk (the renderer can only report the error), so a static "loading…"
 * label becomes a lie that never resolves. This entry offers a retry once the
 * wait looks abnormal; the retry reloads the named frame (or the containing
 * frame, or the page) and the normal reconciliation replaces the slot.
 *
 * The wait starts when the slot is actually on screen, not when it mounts: a
 * lazy frame below the fold (or inside a hidden pane) is intentionally waiting
 * for the viewport, and flipping to "taking longer than expected" before it has
 * even been requested would be wrong. A visible fallback that stays pending for
 * the whole delay still offers the retry.
 *
 * Mounted as the `fallback` prop of a server-rendered frame, so it must not
 * depend on parent props beyond the serializable ones above.
 */
export const FrameFallback = clientEntry(
  import.meta.url + '#FrameFallback',
  function FrameFallbackEntry(handle: Handle<FrameFallbackProps>) {
    let showRetry = false
    let timerStarted = false
    let rootElement: HTMLElement | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let observer: IntersectionObserver | undefined

    handle.queueTask(() => {
      if (timerStarted) return
      timerStarted = true

      let startTimer = () => {
        if (retryTimer !== undefined) return
        let delay = handle.props.retryAfterMs ?? 10_000
        retryTimer = setTimeout(() => {
          showRetry = true
          void handle.update()
        }, delay)
      }

      // Without an observer (no run(), old browser, test harness) keep the
      // previous behavior: the fallback is presumed to be in view.
      if (typeof IntersectionObserver === 'undefined' || !rootElement) {
        startTimer()
      } else {
        observer = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer?.disconnect()
          observer = undefined
          startTimer()
        })
        observer.observe(rootElement)
      }

      handle.signal.addEventListener(
        'abort',
        () => {
          observer?.disconnect()
          observer = undefined
          if (retryTimer !== undefined) clearTimeout(retryTimer)
          retryTimer = undefined
        },
        { once: true },
      )
    })

    return () => (
      <div
        mix={[
          fallbackCss,
          ref((node) => {
            rootElement = node
          }),
        ]}
      >
        <span mix={labelCss}>{handle.props.label}</span>
        <noscript>Diese Ansicht benötigt JavaScript.</noscript>
        {showRetry ? (
          <span mix={retryRowCss}>
            <span role="status" aria-live="polite">
              Das dauert länger als erwartet.
            </span>
            <button
              type="button"
              mix={[
                retryButtonCss,
                on('click', () => {
                  let frame = handle.props.name ? handle.frames.get(handle.props.name) : undefined
                  let target = frame ?? handle.frame
                  target.reload().catch(() => window.location.reload())
                }),
              ]}
            >
              Erneut laden
            </button>
          </span>
        ) : null}
      </div>
    )
  },
)

const fallbackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: '1.25rem 1.5rem',
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

const labelCss = css({
  display: 'block',
})

const retryRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
})

const retryButtonCss = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  font: 'inherit',
  cursor: 'pointer',
})
