import { css } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'

export const formCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.md,
  alignItems: 'flex-end',
})

// Visually hidden but focusable so the dropzone <label> can open the native file
// picker while keeping the input discoverable for keyboard users. Keeps
// `name="file"` / `multiple` in the DOM (server tests + native submit path).
export const fileInputCss = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
})

export const submitCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1.5rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: 'white',
  background: theme.colors.action.primary.background,
  border: 'none',
  borderRadius: theme.radius.md,
  cursor: 'pointer',
  gap: theme.space.xs,
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
})

export const successBanner = css({
  backgroundColor: '#d1fae5',
  border: '1px solid #6ee7b7',
  borderRadius: theme.radius.md,
  color: '#065f46',
  marginBottom: theme.space.md,
  padding: theme.space.md,
})

export const errorBanner = css({
  backgroundColor: theme.colors.action.danger.background,
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.action.danger.foreground,
  marginBottom: theme.space.md,
  padding: theme.space.md,
})

export const bodyTextCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

export const tableCss = css({
  width: '100%',
  borderCollapse: 'collapse',
  // Denser rows: 2px vertical padding (down from space.xs/4px) lets the grid
  // show more rows in the fixed viewport height. Horizontal padding stays at
  // 4px so column text is not clipped.
  '& th, & td': {
    padding: '2px 4px',
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  '& th': {
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.muted,
    position: 'sticky',
    top: 0,
    background: theme.surface.lvl1,
    zIndex: 1,
  },
})

export const sortLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  textDecoration: 'none',
  color: 'inherit',
  cursor: 'pointer',
  '&:hover': { color: theme.colors.text.primary },
})

// Wrapper for the search filter + bulk-delete actions. Keeping them in one
// horizontal row (instead of the bulk toolbar occupying its own full-width row
// above the table) frees vertical space so the table shows more rows. The
// filter form grows to fill the row while the compact bulk form hugs the right.
export const toolsRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
})

export const filterBarCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
  flex: '1 1 auto',
  minWidth: 0,
})

export const sortArrowCss = css({
  fontSize: theme.fontSize.xs,
  lineHeight: 1,
  color: theme.colors.text.muted,
})

export const sortArrowActiveCss = css({
  fontSize: theme.fontSize.xs,
  lineHeight: 1,
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.bold,
})

// Viewport-bounded page: let the page section fill the remaining content height
// so the table region can absorb it and scroll internally (see the
// remix3-bounded-scroll-flexchain pattern). The reduced `gap` here also tightens
// vertical spacing between the section header and the two panels, returning that
// space to the scrollable table so more rows are visible.
export const pageSectionCss = css({
  flex: 1,
  minHeight: 0,
  gap: theme.space.xs,
})

// Compact the upload/search panel so it takes less vertical space on screen
// (smaller padding and internal gap than the shared `panelCss` defaults).
export const uploadPanelCss = css({
  padding: theme.space.xs,
  gap: theme.space.xs,
})

export const tablePanelCss = css({
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  // Slightly wider grid: tightening horizontal padding lets the table span more
  // of the panel width. Reduced vertical padding + a smaller internal gap give
  // that space back to the scrollable table so more rows are visible.
  padding: theme.space.sm,
  gap: theme.space.sm,
})

export const tableScrollCss = css({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
})

export const paginationCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  // Reduced top margin keeps the pagination bar close to the table, returning
  // the leftover vertical space to the scrollable grid above it.
  marginTop: theme.space.sm,
  flexShrink: 0,
})

export const paginationButtonsCss = css({
  display: 'flex',
  gap: theme.space.sm,
})

export const thActionsCss = css({
  textAlign: 'right',
  width: '208px',
})

export const thCheckboxCss = css({
  width: '36px',
  textAlign: 'center',
})

export const tdCheckboxCss = css({
  width: '36px',
  textAlign: 'center',
})

// The bulk forms are siblings of the search filter form and the scrollable table
// (so the per-row delete forms inside the table are not nested inside another
// <form>, which is invalid HTML). Row checkboxes associate to the delete form via
// the HTML `form` attribute. `flex: none` keeps each a compact item that neither
// grows nor wraps onto its own full-width line.
export const bulkFormCss = css({
  flex: 'none',
})

// Visually joins the bulk delete and bulk download forms into one button group.
// The two buttons must stay in separate forms (the delete form is intercepted by
// the frame runtime, the download form submits natively via `data-rmx-document`),
// so the group is a presentational wrapper around both.
export const bulkGroupCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  flex: 'none',
})

export const bulkToolbarCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  whiteSpace: 'nowrap',
})

export const selectedCountCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

export const bulkDeleteBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.4rem 0.9rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.action.danger.foreground,
  background: theme.colors.action.danger.background,
  border: 'none',
  // Left edge of the joined group: round the outer corners, square the inner.
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const bulkDownloadBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.4rem 0.9rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.action.primary.foreground,
  background: theme.colors.action.primary.background,
  border: 'none',
  // Right edge of the joined group: round the outer corners, square the inner,
  // and separate from the delete button with a subtle divider.
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const tdActionsCss = css({
  textAlign: 'right',
  whiteSpace: 'nowrap',
})

export const rowActionsCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 0,
})

export const iconActionCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  minWidth: '28px',
  padding: 0,
  border: `1px solid ${theme.colors.border}`,
  // Left edge of the per-row action group (download is always first): round the
  // outer corners, square the inner.
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

export const iconActionDangerCss = css({
  color: theme.colors.action.danger.background,
  borderColor: 'transparent',
  // Right edge of the per-row action group (delete is always second): square the
  // inner corners, round the outer. The download link's right border acts as the
  // divider between the two.
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

// "More options" trigger that opens the per-row context menu. Sits to the left
// of the download|delete group with a small gap so it reads as its own control
// rather than a third button in the joined group.
export const rowMenuCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  minWidth: '28px',
  padding: 0,
  marginRight: theme.space.xs,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

export const idCellCss = css({ whiteSpace: 'nowrap' })

export const filenameCellCss = css({ whiteSpace: 'nowrap' })

export const sizeCellCss = css({ whiteSpace: 'nowrap' })

export const mimeBadgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.1rem 0.5rem',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  background: theme.surface.lvl3,
  borderRadius: 999,
  whiteSpace: 'nowrap',
})

export const emptyStateCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.space.sm,
  padding: theme.space.lg,
  color: theme.colors.text.muted,
  textAlign: 'center',
})

export const emptyStateGlyph = css({
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: theme.surface.lvl2,
  color: theme.colors.text.muted,
})

// ── Upload dropzone ─────────────────────────────────────────────

// The upload form is a flex row: the dropzone grows, the submit button hugs the
// right, and the pending-file list + validation message span the full width.
export const dropzoneCss = css({
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  position: 'relative',
  padding: `${theme.space.sm} ${theme.space.md}`,
  border: `1px dashed ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.muted,
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  '&[data-dragover="true"]': {
    borderColor: theme.colors.action.primary.background,
    background: theme.surface.lvl2,
  },
  '&[data-disabled="true"]': {
    opacity: 0.6,
    pointerEvents: 'none',
  },
})

export const dropzoneLabelCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.5rem 1rem',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: 'white',
  background: theme.colors.action.primary.background,
  borderRadius: theme.radius.md,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

export const dropzoneHintCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

export const pendingListCss = css({
  flexBasis: '100%',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  marginTop: theme.space.xs,
})

export const validationErrorCss = css({
  flexBasis: '100%',
  margin: 0,
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.sm,
  color: theme.colors.action.danger.foreground,
})

// ── Storage quota indicator ─────────────────────────────────────

export const quotaRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
  flexWrap: 'wrap',
  marginTop: theme.space.sm,
})

export const quotaTextCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

export const quotaTrackCss = css({
  flex: '1 1 auto',
  minWidth: '120px',
  height: '8px',
  background: theme.surface.lvl3,
  borderRadius: 999,
  overflow: 'hidden',
})

export const quotaTrackNearCss = css({
  background: theme.colors.action.danger.background,
})

export const quotaFillCss = css({
  display: 'block',
  height: '100%',
  background: theme.colors.action.primary.background,
  borderRadius: 999,
  transition: 'width 0.2s ease',
})

export const quotaFillNearCss = css({
  background: theme.colors.action.danger.background,
})

// "Auswahl aufheben" — clears the cross-page selection.
export const clearSelectionBtnCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.4rem 0.6rem',
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
  '&:hover': { color: theme.colors.text.primary },
})
