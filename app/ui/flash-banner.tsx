import { css, type Handle } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'
import { theme } from './theme/theme.ts'

type FlashState = { error?: string; success?: string }

/**
 * Reads the one-shot PRG flash for this response.
 *
 * A flash is surfaced by exactly one layout/component per response: the
 * top-level `Layout` on document renders, or the fragment renderer (sidebar
 * shell, verwaltung fragment branch, settings/appointments-new frame branch)
 * on frame renders. Do not render two of them in one response.
 */
function readFlash(): FlashState {
  let flash: FlashState = {}
  try {
    let session = getContext().session
    if (!session) return flash
    let error = session.get('error')
    if (typeof error === 'string') flash.error = error
    let success = session.get('success')
    if (typeof success === 'string') flash.success = success
  } catch {
    /* no session context */
  }
  return flash
}

/**
 * Renders the pending flash banner(s). `compact` adds the rounded in-panel
 * treatment used by frame fragments; the document layout uses the plain
 * full-width variant.
 */
export function FlashBanner(handle: Handle<{ compact?: boolean }>) {
  return () => {
    let { error, success } = readFlash()
    if (!error && !success) return null
    let compactMix = handle.props.compact ? [compactCss] : []
    return (
      <>
        {error ? <div mix={[bannerCss, errorCss, ...compactMix]}>{error}</div> : null}
        {success ? <div mix={[bannerCss, successCss, ...compactMix]}>{success}</div> : null}
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
