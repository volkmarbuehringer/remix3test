import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'

import { theme } from './theme/theme.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { PageSizeSlider } from './page-size-slider.browser.tsx'
import { PAGE_SIZE_MAX, PAGE_SIZE_MIN } from '../utils/get-page-size.ts'
import type { PageSizeKey } from '../utils/get-page-size.ts'

export interface PageSizeControlProps {
  /** POST endpoint that persists the override. */
  action: string
  /** Page key the override is stored under. */
  pageKey: PageSizeKey
  /** Effective page size currently used to render the grid. */
  pageSize: number
  /** Saved override for this page, or null when the global default applies. */
  pageSizeOverride: number | null
  /** Unique DOM id for the range input (one control per page). */
  controlId: string
}

/**
 * "Einträge pro Seite" slider shown beside a grid's pagination. Saves a
 * per-page override (see `app/utils/get-page-size.ts`) that shadows the global
 * default from Settings until reset. Mirrors the Settings slider markup and
 * reuses the PageSizeSlider client entry for the live readout.
 */
export function PageSizeControl(handle: Handle<PageSizeControlProps>) {
  return () => {
    let { action, pageKey, pageSize, pageSizeOverride, controlId } = handle.props

    // Post back to the current grid URL; the server drops `offset` so paging
    // restarts at page 1 after the size changes.
    let returnTo = ''
    try {
      let url = new URL(getContext().request.url)
      returnTo = url.pathname + url.search
    } catch {
      /* no request context (unit render); the server falls back to /verwaltung */
    }

    return (
      <form action={action} method="POST" mix={formCss} data-current-page-size={String(pageSize)}>
        <CsrfTokenInput />
        <input type="hidden" name="pageKey" value={pageKey} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label htmlFor={controlId} mix={labelCss}>
          <span>Einträge pro Seite</span>
          <span mix={rangeControlCss} data-page-size-control="true">
            <input
              id={controlId}
              type="range"
              name="pageSize"
              min={PAGE_SIZE_MIN}
              max={PAGE_SIZE_MAX}
              step={1}
              value={String(pageSize)}
              mix={rangeCss}
              data-page-size-range="true"
            />
            <output mix={rangeOutputCss} data-page-size-output="true" htmlFor={controlId}>
              {pageSize}
            </output>
          </span>
        </label>
        <button type="submit" name="_action" value="page-size" mix={applyCss}>
          Speichern
        </button>
        {pageSizeOverride != null ? (
          <button type="submit" name="_action" value="reset-page-size" mix={resetCss}>
            Standard
          </button>
        ) : null}
        <PageSizeSlider />
      </form>
    )
  }
}

const formCss = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '0.5rem',
})

const labelCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

const rangeControlCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
})

const rangeCss = css({
  width: '9rem',
  accentColor: theme.colors.action.primary.background,
  cursor: 'pointer',
})

const rangeOutputCss = css({
  minWidth: '3ch',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const applyCss = css({
  minHeight: '2rem',
  padding: '0.25rem 0.7rem',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  cursor: 'pointer',
  fontSize: theme.fontSize.sm,
})

const resetCss = css({
  padding: '0.25rem 0.4rem',
  border: 'none',
  background: 'none',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  fontSize: theme.fontSize.xs,
  textDecoration: 'underline',
})
