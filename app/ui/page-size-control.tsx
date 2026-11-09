import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'

import { theme } from './theme/theme.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { pageSizeOptions, PAGE_SIZE_MAX, PAGE_SIZE_MIN } from '../utils/get-page-size.ts'
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
 * "Einträge pro Seite" control shown beside a grid's pagination. Saves a
 * per-page override (see `app/utils/get-page-size.ts`) that shadows the global
 * default from Settings until reset.
 *
 * The preset select replaced the old range slider: the slider spanned 5..100
 * in steps of one, so 96 drag stops shared a 144px track — unusable on a
 * phone, where a grid row is a ~300px stacked card and the page size matters
 * most. The free-form number input beside the select restores arbitrary sizes
 * without bringing the slider back; a value typed there wins over the select.
 */
export function PageSizeControl(handle: Handle<PageSizeControlProps>) {
  return () => {
    let { action, pageKey, pageSize, pageSizeOverride, controlId } = handle.props
    let customId = `${controlId}-custom`

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
          <PageSizeSelect id={controlId} pageSize={pageSize} />
        </label>
        <label
          htmlFor={customId}
          mix={labelCss}
          title="Überschreibt die Auswahl; leer lassen, um die Auswahl zu verwenden."
        >
          <span>Eigene Größe</span>
          <PageSizeCustomInput id={customId} />
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

export interface PageSizeSelectProps {
  /** Unique DOM id for the control (one control per page). */
  id: string
  /** Effective page size currently used to render the grid. */
  pageSize: number
}

/**
 * Preset select shared by the per-grid control and Settings so both render the
 * same options. A saved size that is not a preset is added as an option by
 * `pageSizeOptions()`.
 */
export function PageSizeSelect(handle: Handle<PageSizeSelectProps>) {
  return () => {
    let { id, pageSize } = handle.props
    return (
      <select
        id={id}
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
    )
  }
}

export interface PageSizeCustomInputProps {
  /** Unique DOM id for the control (one control per page). */
  id: string
}

/**
 * Optional free-form size beside the preset select. Empty means "use the
 * select"; any whole 5–100 wins over it. Shared with Settings so the server
 * always receives the same `pageSizeCustom` field.
 */
export function PageSizeCustomInput(handle: Handle<PageSizeCustomInputProps>) {
  return () => {
    let { id } = handle.props
    return (
      <input
        id={id}
        name="pageSizeCustom"
        type="number"
        min={PAGE_SIZE_MIN}
        max={PAGE_SIZE_MAX}
        step={1}
        inputMode="numeric"
        placeholder={`${PAGE_SIZE_MIN}–${PAGE_SIZE_MAX}`}
        mix={pageSizeCustomCss}
        data-page-size-custom="true"
      />
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
const pageSizeSelectCss = css({
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

/**
 * Free-form override beside the select. Same target size and focus ring as the
 * select; narrow enough that both fit on one grid-footer row.
 */
const pageSizeCustomCss = css({
  minHeight: '2.75rem',
  width: '6.5rem',
  maxWidth: '100%',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.sm,
  fontFamily: theme.fontFamily.sans,
  fontVariantNumeric: 'tabular-nums',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}`,
  },
  '&::placeholder': {
    color: theme.colors.text.muted,
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
