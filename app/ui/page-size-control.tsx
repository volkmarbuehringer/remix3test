import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'

import { theme } from './theme/theme.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { pageSizeOptions } from '../utils/get-page-size.ts'
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
  /** Unique DOM id for the control (one control per page). */
  controlId: string
}

/**
 * "Einträge pro Seite" select shown beside a grid's pagination. Saves a
 * per-page override (see `app/utils/get-page-size.ts`) that shadows the global
 * default from Settings until reset.
 *
 * A select replaced the old range slider: the slider spanned 5..100 in steps
 * of one, so 96 drag stops shared a 144px track — unusable on a phone, where
 * a grid row is a ~300px stacked card and the page size matters most. The
 * select posts the same `pageSize` field, so the server contract is unchanged.
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
          <select
            id={controlId}
            name="pageSize"
            mix={pageSizeSelectCss}
            data-page-size-select="true"
            data-page-size-control="true"
          >
            {pageSizeOptions(pageSize).map((option) => (
              <option key={option} value={String(option)} selected={option === pageSize}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" name="_action" value="page-size" mix={applyCss}>
          Speichern
        </button>
        {pageSizeOverride != null ? (
          <button type="submit" name="_action" value="reset-page-size" mix={resetCss}>
            Standard
          </button>
        ) : null}
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

/**
 * Shared by the per-grid control and the Settings control so both render the
 * same select. Sized for a native picker on a phone: 44px tall, the WCAG 2.2
 * target size, with the current value in tabular figures.
 */
export const pageSizeSelectCss = css({
  minHeight: '2.75rem',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  fontFamily: theme.fontFamily.sans,
  fontVariantNumeric: 'tabular-nums',
  cursor: 'pointer',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}`,
  },
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
