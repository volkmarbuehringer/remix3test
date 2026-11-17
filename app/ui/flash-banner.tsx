import { css, type Handle } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'
import { currentRequestIsInlinedFrame } from '../utils/frame-target.ts'
import { readFlash, type FlashState } from '../utils/flash.ts'
import { theme } from './theme/theme.ts'

/**
 * Reads the one-shot PRG flash for this response.
 *
 * A flash is surfaced by exactly one owner per response: the document `Layout`
 * on document renders, or `FlashFragment` (`app/ui/flash-fragment.tsx`) on
 * frame renders. A frame the renderer resolves *inside* another response is
 * part of that document, so the document `Layout` surfaces the flash there and
 * the inlined fragment must not — see `currentRequestIsInlinedFrame()`.
 */
function readFlashState(): FlashState {
  try {
    return readFlash(getContext().session)
  } catch {
    /* no session context */
  }
  return {}
}

/**
 * Renders the pending flash banner(s). `compact` adds the rounded in-panel
 * treatment used by frame fragments; the document layout uses the plain
 * full-width variant.
 *
 * The error banner carries `role="alert"` so it is announced when it is
 * inserted (a frame swap) or parsed (a PRG document load). The success banner
 * deliberately has no live role: a `role="status"` node introduced by a frame
 * swap is a brand-new live region and is not reliably announced. The persistent
 * `FlashAnnouncer` in the document shell mirrors it into a live region that
 * existed before the swap — see `app/ui/flash-announcer.browser.tsx`.
 */
export function FlashBanner(handle: Handle<{ compact?: boolean }>) {
  return () => {
    // A self-relay shell resolves its frame inside the document render, so a
    // full page load would otherwise render the same one-shot flash twice: once
    // here and once in the document `Layout`. The document owns it.
    if (currentRequestIsInlinedFrame()) return null
    let { error, success } = readFlashState()
    if (!error && !success) return null
    let compactMix = handle.props.compact ? [compactCss] : []
    return (
      <>
        {error ? (
          <div
            data-flash-banner=""
            data-flash-tone="error"
            role="alert"
            aria-atomic="true"
            mix={[bannerCss, errorCss, ...compactMix]}
          >
            {error}
          </div>
        ) : null}
        {success ? (
          <div
            data-flash-banner=""
            data-flash-tone="success"
            mix={[bannerCss, successCss, ...compactMix]}
          >
            {success}
          </div>
        ) : null}
      </>
    )
  }
}

const surface = theme.surface as Record<string, string>

const bannerCss = css({
  padding: `${theme.space.sm} ${theme.space.lg}`,
  fontSize: theme.fontSize.sm,
  textAlign: 'center',
})

const errorCss = css({
  background: surface.dangerBg,
  color: surface.dangerText,
  borderBottom: `1px solid ${surface.dangerBorder}`,
})

const successCss = css({
  background: surface.successBg,
  color: surface.successText,
  borderBottom: `1px solid ${surface.successBorder}`,
})

const compactCss = css({
  borderRadius: theme.radius.md,
  marginBottom: theme.space.sm,
})
