import { css } from 'remix/component'
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
  // Phones wrap the button onto its own line (see `formRowCss`): make it span
  // the full width there instead of hugging the right edge.
  '@media (max-width: 480px)': { flex: '1 1 100%' },
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
})

export const successBanner = css({
  // Success tokens, not hex: the theme flips them for dark mode (the danger
  // banner below already follows its tokens, so a hardcoded mint box was the one
  // element that stayed light).
  backgroundColor: theme.colors.success.background,
  border: `1px solid ${theme.colors.success.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.success.foreground,
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
  // Fixed layout keeps the grid inside its panel: a long file name truncates
  // with an ellipsis (see `filenameCellCss`) instead of stretching the table
  // past the panel and adding a horizontal scrollbar. Column widths come from
  // the header cells below, so they stay stable across sort/filter/page.
  tableLayout: 'fixed',
  // Floor for the grid: below this the pinned columns (see the `th*` widths)
  // would eat the auto Dateiname column down to zero. Phones scroll the grid
  // horizontally instead, which keeps every column readable.
  minWidth: '740px',
  borderCollapse: 'collapse',
  // Denser rows: 1px vertical padding (down from space.xs/4px) plus `lineHeight:
  // 1` removes the baseline descender space that the inline-flex row actions add
  // to every cell. Together with the 24px action buttons that roughly halves the
  // row height, so a full page of rows fits in the fixed viewport height.
  // Horizontal padding stays at 4px so column text is not clipped.
  '& th, & td': {
    padding: '1px 4px',
    textAlign: 'left',
    verticalAlign: 'middle',
    lineHeight: 1,
  },
  '& th': {
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.muted,
    position: 'sticky',
    top: 0,
    background: theme.surface.lvl1,
    zIndex: 1,
    // `theme.colors.border` is the token *group*; interpolating it produced an
    // invalid declaration and the rows silently had no separators at all.
    borderBottom: `1px solid ${theme.colors.border.default}`,
  },
  '& td': {
    borderBottom: `1px solid ${theme.colors.border.subtle}`,
  },
  // Zebra + hover feedback, mirroring the shared admin grid (`table.row`). With
  // 26px rows and seven columns the banding makes row tracking much easier.
  // `lvl1` is one step away from the panel's `lvl0`; the hover rule must stay
  // last so it also wins on even rows (both have the same specificity).
  '& tbody tr:nth-child(even)': { background: theme.surface.lvl1 },
  // Freshly uploaded rows stay tinted for this render so users can spot where
  // their file landed; the next navigation clears the tint naturally.
  '& tbody tr[data-uploaded="true"]': { background: theme.colors.success.background },
  '& tbody tr:hover': { background: theme.surface.lvl3 },
  '@media (max-width: 1024px)': {
    // The grid scrolls sideways below this (the table has a 740px floor), so both
    // edge columns are pinned: the select checkbox on the left, the row actions on
    // the right. Without the right pin the download/delete buttons sit ~400px
    // off-screen on a phone and have to be swiped into view for every row.
    //
    // Sticky cells need opaque backgrounds that follow the row state, otherwise
    // the columns scrolling underneath show through. The selectors target the
    // first and last cell because the checkbox and Aktionen columns are always
    // rendered first and last, in both the header and the body rows. The
    // border-left marks where the frozen actions column starts.
    '& thead th:first-child': { position: 'sticky', left: 0, zIndex: 2 },
    '& thead th:last-child': {
      position: 'sticky',
      right: 0,
      zIndex: 2,
      borderLeft: `1px solid ${theme.colors.border.default}`,
    },
    '& tbody td:first-child': {
      position: 'sticky',
      left: 0,
      zIndex: 1,
      background: theme.surface.lvl0,
    },
    '& tbody tr:nth-child(even) td:first-child': { background: theme.surface.lvl1 },
    '& tbody tr:hover td:first-child': { background: theme.surface.lvl3 },
    '& tbody td:last-child': {
      position: 'sticky',
      right: 0,
      zIndex: 1,
      background: theme.surface.lvl0,
      borderLeft: `1px solid ${theme.colors.border.default}`,
    },
    '& tbody tr:nth-child(even) td:last-child': { background: theme.surface.lvl1 },
    '& tbody tr:hover td:last-child': { background: theme.surface.lvl3 },
    // Keep the pinned cells' opaque backgrounds in sync with the upload tint.
    '& tbody tr[data-uploaded="true"] td:first-child': {
      background: theme.colors.success.background,
    },
    '& tbody tr[data-uploaded="true"] td:last-child': {
      background: theme.colors.success.background,
    },
    '& tbody tr[data-uploaded="true"]:hover td:first-child': {
      background: theme.surface.lvl3,
    },
    '& tbody tr[data-uploaded="true"]:hover td:last-child': {
      background: theme.surface.lvl3,
    },
  },
  // Phones: ID, Typ, Größe and Datum move into the filename cell's meta line
  // (see `filenameMetaCss`), so the grid fits without horizontal scrolling and
  // the filename + actions stay readable side by side.
  '@media (max-width: 720px)': {
    minWidth: '0',
    '& th:nth-child(2), & td:nth-child(2), & th:nth-child(4), & td:nth-child(4), & th:nth-child(5), & td:nth-child(5), & th:nth-child(6), & td:nth-child(6)':
      { display: 'none' },
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
  // The bulk client entry swaps this toolbar for the selection actions while
  // rows are selected; the author `display` above would otherwise beat `hidden`.
  '&[hidden]': { display: 'none' },
})

// ── Mobile sort bar ────────────────────────────────────────────
// Shown only below 720px, where the Typ/Größe/Datum headers (and their sort
// links) are hidden to make the grid fit the viewport.
export const mobileSortCss = css({
  display: 'none',
  '@media (max-width: 720px)': {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.space.xs,
    flexBasis: '100%',
    marginTop: theme.space.xs,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.muted,
  },
})

export const mobileSortLabelCss = css({
  marginRight: theme.space.xs,
})

export const mobileSortLinkCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  minHeight: '24px',
  padding: `0 ${theme.space.xs}`,
  color: theme.colors.text.secondary,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.full,
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

export const mobileSortLinkActiveCss = css({
  color: theme.colors.action.primary.foreground,
  background: theme.colors.action.primary.background,
  borderColor: theme.colors.action.primary.background,
  fontWeight: theme.fontWeight.semibold,
  '&:hover': {
    color: theme.colors.action.primary.foreground,
    background: theme.colors.action.primary.background,
  },
})

// ── Kind filter tabs with counts ───────────────────────────────
// The tabs carry the number of files each grouping would show (scoped by the
// active search), so an empty grouping is obvious before it is clicked.
export const kindTabCss = css({
  gap: theme.space.xs,
})

export const kindCountCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '18px',
  padding: '0 4px',
  borderRadius: 999,
  background: theme.surface.lvl3,
  // Secondary, not muted: the badge carries real information (how many files a
  // filter would show) at 11px, and muted text on lvl3 measured ~2.9:1 in dark
  // mode (below the 4.5:1 minimum for small text).
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.semibold,
  lineHeight: 1.5,
})

export const kindCountActiveCss = css({
  background: 'transparent',
  color: 'inherit',
  opacity: 0.85,
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
// remix3-styling (§ CSS & Layout) `references/remix3-css-and-layout/bounded-scroll-flexchain.md` pattern). The reduced `gap` here also tightens
// vertical spacing between the section header and the two panels, returning that
// space to the scrollable table so more rows are visible.
export const pageSectionCss = css({
  flex: 1,
  minHeight: 0,
  gap: theme.space.xs,
  // Phones: stop filling the viewport. Inside the full-height admin shell a
  // bounded grid leaves only a ~4-row scroll hole in the middle of the page;
  // letting the page itself scroll shows the whole file list at once.
  '@media (max-width: 720px)': { flex: '0 0 auto' },
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
  // Phones: content-sized panel, so the page scrolls instead of a tiny row
  // region (see pageSectionCss).
  '@media (max-width: 720px)': { flex: '0 0 auto', overflow: 'visible' },
})

export const tableScrollCss = css({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  // Phones: the row region grows with its rows and the page scrolls instead, so
  // the last visible row is never cut in half by a fixed-height scroll box.
  '@media (max-width: 720px)': { flex: '0 0 auto', overflow: 'visible' },
})

export const paginationCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  // No top margin: the panel's own row gap separates the pagination bar from the
  // grid, and every pixel saved here is a pixel the grid can show another row in.
  flexShrink: 0,
  // Narrow viewports: give the footer its own two rows instead of squeezing the
  // info, page links and page-size control into one line that wraps mid-control.
  '@media (max-width: 1100px)': {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.space.sm,
  },
})

export const paginationButtonsCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  '@media (max-width: 1100px)': { justifyContent: 'space-between' },
})

/** Prev / page numbers / next cluster. Wraps as a unit on narrow screens. */
export const pageNavCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.xs,
})

export const pageNumbersCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '2px',
})

/** Compact page-number link; table.pageLink supplies padding, colour and hover. */
export const pageNumberLinkCss = css({
  justifyContent: 'center',
  minWidth: '28px',
})

/** Current page: highlighted, not interactive, announced via aria-current. */
export const pageCurrentCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '28px',
  padding: theme.space.xs + ' ' + theme.space.sm,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

export const pageGapCss = css({
  padding: '0 2px',
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

/** Keeps the page-size control pinned right on desktop and full-width on phones. */
export const pageSizeSlotCss = css({
  marginLeft: 'auto',
  '@media (max-width: 720px)': {
    marginLeft: 0,
    width: '100%',
    // Phones: the save button used to wrap under the slider as a narrow,
    // left-aligned orphan. Stretch it across the row so the control reads as
    // one block.
    '& form > button': { flex: '1 1 auto' },
  },
})

export const thActionsCss = css({
  textAlign: 'right',
  // Two joined 24px buttons (download | delete) plus the cell padding. Wide
  // enough for the "Aktionen" header too, so the label cannot overhang the
  // panel and add a horizontal scrollbar.
  width: '76px',
})

// Column widths for the fixed-layout grid (see `tableCss`). Only `Dateiname`
// stays auto so it absorbs the leftover width; the other columns are pinned to
// the width their content actually needs. On narrow screens the fixed widths
// win, so the panel scrolls horizontally with readable columns instead of
// shredding every cell.
export const thIdCss = css({ width: '48px' })

export const thTypeCss = css({ width: '80px' })

export const thSizeCss = css({ width: '84px' })

// Wide enough for an absolute German date ("Mo., 07.09.2026") on one line, so
// the Datum column never wraps and every row keeps the same height.
export const thDateCss = css({ width: '120px' })

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
  '@media (max-width: 960px)': { flex: '1 1 auto', minWidth: 0 },
})

// Visually joins the bulk delete and bulk download forms into one button group.
// The two buttons must stay in separate forms (the delete form is intercepted by
// the frame runtime, the download form submits natively via `data-rmx-document`),
// so the group is a presentational wrapper around both.
//
// Together the two forms are 636px wide, which no longer fits the content column
// once the viewport drops below ~960px (the admin shell then clips the overflow
// and the "Ausgewählte herunterladen" button becomes unreachable). Below that the
// group stacks into a column and each form takes the full width.
export const bulkGroupCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  // The group replaces the filter toolbar while rows are selected, so it starts
  // at the left edge like the search form it stands in for.
  flex: 'none',
  '@media (max-width: 960px)': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    flex: '1 1 100%',
    gap: theme.space.sm,
  },
  // The group is hidden until a row is selected (the bulk client entry toggles
  // `hidden` once hydrated). The author `display` above would otherwise beat the
  // UA `[hidden]` rule.
  '&[hidden]': { display: 'none' },
})

export const bulkToolbarCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  whiteSpace: 'nowrap',
  '@media (max-width: 960px)': { flexWrap: 'wrap', whiteSpace: 'normal' },
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
  // Stacked group (see `bulkGroupCss`): standalone button, full row width.
  '@media (max-width: 960px)': {
    flex: '1 1 auto',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
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
  // Stacked group (see `bulkGroupCss`): standalone button, full row width, with
  // the joined-group divider dropped.
  '@media (max-width: 960px)': {
    flex: '1 1 auto',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderLeft: 'none',
  },
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
  // 24px square: the WCAG 2.2 minimum target size, and the main lever on row
  // height (28px used to set a 45px row because of the baseline descender).
  width: '24px',
  height: '24px',
  minWidth: '24px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
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

export const idCellCss = css({ whiteSpace: 'nowrap' })

// The only auto-width column in the fixed-layout grid, so it absorbs whatever
// width is left. Long names truncate here (the full name is in the cell's
// `title`) rather than widening the table.
export const filenameCellCss = css({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  // On phones the cell also carries the meta line (see `filenameMetaCss`), so
  // it switches to a wrapping block that can show both lines.
  '@media (max-width: 720px)': {
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
  },
})

export const filenameTextCss = css({
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

// The filename is a download link (the row's primary action). It reads as plain
// text until hovered/focused so the grid does not turn into a wall of blue
// links, but it is a real anchor: middle-click, "save link as" and keyboard
// activation all work like the actions-column download button.
export const filenameLinkCss = css({
  color: theme.colors.text.primary,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: '2px',
    borderRadius: theme.radius.sm,
  },
})

// Secondary metadata for narrow screens, where the dedicated Typ/Größe/Datum
// columns are hidden from the grid. On desktop the columns speak for themselves.
export const filenameMetaCss = css({
  display: 'none',
  '@media (max-width: 720px)': {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.space.xs,
    marginTop: '2px',
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.muted,
  },
})

export const sizeCellCss = css({ whiteSpace: 'nowrap' })

// The date cell never wraps: relative values ("vor 5 Tagen") are short, but the
// absolute fallback for older uploads ("Mo., 07.09.2026") would otherwise break
// onto two lines and bump the row height by ~4px.
export const dateCellCss = css({ whiteSpace: 'nowrap' })

export const mimeBadgeCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.1rem 0.5rem',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  // `lvl2` + a real border keeps the chip legible on all three row states: the
  // hover background is `lvl3`, which used to swallow a `lvl3` badge entirely.
  background: theme.surface.lvl2,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: 999,
  whiteSpace: 'nowrap',
  // Unknown MIME types fall back to the raw type string, which can be far wider
  // than the fixed Typ column; truncate it instead of overflowing the cell.
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const emptyStateCss = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  // Absorb the bounded panel's leftover height so the message sits in the
  // middle of the grid area instead of at its top with a large blank block
  // underneath. `1 1 auto` (not `1`) keeps it content-sized on phones, where
  // the panel is no longer viewport-bounded.
  flex: '1 1 auto',
  minHeight: 0,
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

// "Filter zurücksetzen" action in a filtered empty state.
export const emptyActionCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${theme.space.xs} ${theme.space.md}`,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.action.primary.foreground,
  background: theme.colors.action.primary.background,
  borderRadius: theme.radius.md,
  textDecoration: 'none',
  '&:hover': { opacity: 0.9 },
})

// ── Upload dropzone ─────────────────────────────────────────────

// One compact row holding the dropzone and the submit button. Keeping them in a
// dedicated row (instead of letting them be siblings of the full-width
// pending-list / validation items) guarantees they share a single line: the
// button no longer wraps onto its own row, which used to leave a big empty gap
// next to "Dateien auswählen" and cost ~70px of the table's height.
export const formRowCss = css({
  display: 'flex',
  alignItems: 'stretch',
  gap: theme.space.sm,
  flex: '1 1 auto',
  minWidth: 0,
  // On phones the row is too narrow for the dropzone label and the submit button
  // side by side; let the button wrap onto a full-width second line rather than
  // squeezing (and clipping) the dropzone.
  '@media (max-width: 480px)': { flexWrap: 'wrap' },
})

// The upload form is a flex row: the dropzone grows, the submit button hugs the
// right, and the pending-file list + validation message span the full width.
export const dropzoneCss = css({
  flex: '1 1 auto',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  position: 'relative',
  padding: `${theme.space.xs} ${theme.space.md}`,
  border: `1px dashed ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.muted,
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  // The real <input type="file"> is visually hidden, so without this a keyboard
  // user tabbing to the dropzone gets no focus indicator at all (WCAG 2.4.7).
  // `:has()` keeps the ring on the visible box; `:focus-visible` keeps it off for
  // mouse clicks.
  '&:has(input:focus-visible)': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: '2px',
  },
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
  padding: '0.35rem 0.8rem',
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
  // Phones: the row cannot fit the label and the hint, and a nowrap hint would
  // spill over the submit button. The "Dateien auswählen" button is enough.
  '@media (max-width: 640px)': { display: 'none' },
})

// Policy line under the dropzone ("PDF, Bilder und Text · maximal 50 MB …"). It
// spans the form row so the accepted types and limits are visible before a
// file is chosen, instead of only surfacing after a rejected upload.
export const uploadHintCss = css({
  flexBasis: '100%',
  margin: 0,
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.muted,
})

// "3 Dateien ausgewählt (12,4 MB)" plus an "Alle entfernen" button above the
// pending file chips.
export const pendingSummaryCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexBasis: '100%',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  '&[hidden]': { display: 'none' },
})

export const pendingClearBtnCss = css({
  // 24px min height keeps the small text link a WCAG 2.2-sized touch target.
  minHeight: '24px',
  padding: '0 0.25rem',
  border: 'none',
  background: 'none',
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  textDecoration: 'underline',
  cursor: 'pointer',
  '&:hover': { color: theme.colors.text.primary },
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
  // `display: flex` would otherwise override the UA `[hidden] { display: none }`
  // rule (author styles beat the UA sheet), leaving an empty flex item with
  // `flex-basis: 100%` in the form that forced the submit button onto its own
  // row. Keep the hidden state authoritative.
  '&[hidden]': { display: 'none' },
})

export const validationErrorCss = css({
  flexBasis: '100%',
  margin: 0,
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.sm,
  color: theme.colors.action.danger.foreground,
  // Same hidden-state guard as `pendingListCss`, so the reserved validation slot
  // never keeps a flex line in the form.
  '&[hidden]': { display: 'none' },
})

// ── Storage quota indicator ─────────────────────────────────────

export const quotaRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.md,
  flexWrap: 'wrap',
})

export const quotaTextCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  '@media (max-width: 720px)': { width: '100%' },
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
  // The button is toggleable via its `hidden` attribute; without this guard the
  // author `display: inline-flex` above beats the UA `[hidden]{display:none}`
  // rule and "Auswahl aufheben" stays visible with nothing selected.
  '&[hidden]': { display: 'none' },
})
