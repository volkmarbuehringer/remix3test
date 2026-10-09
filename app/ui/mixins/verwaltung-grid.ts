import { css } from 'remix/component'
import { theme } from '../theme/theme.ts'

/**
 * Fill chain for the Verwaltung data grids (Termine/Angebote/Ressourcen/
 * Angebotskonfigurationen).
 *
 * The Verwaltung shell's page area is a bounded scroll container. Rather than
 * letting the toolbar + 15 rows overflow it (a page-level scrollbar), these
 * mixes let the grid fill the area and make only the rows the scroll region.
 * With the default 15-row page the rows fit on a normal viewport, so nothing
 * scrolls; on a short viewport the column header and pagination stay pinned and
 * only the rows scroll — the page never does.
 *
 * Scoped to /verwaltung grid pages on purpose: the admin grids keep their
 * existing document-flow layout.
 */
// `flex: 1 1 auto` (not `flex: 1`) so the same class is safe when the page is
// NOT in the bounded shell (frame fragments / agent panel): a content-sized
// flex column would collapse a `flex-basis: 0` child to zero height.
export const verwaltungGridFill = css({
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
})

export const verwaltungGridWrap = css({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
})

/**
 * Tighter row/header padding so 15 rows fit. Desktop only: below 769px the
 * grids switch to the stacked-card layout and keep their own spacing.
 *
 * `!important` is deliberate — this rule and the shared cell mixins land in
 * sibling `@layer rmx.*` sub-layers where declaration order, not specificity,
 * decides the winner (the same cascade caveat as `table.mobileCards`).
 */
export const verwaltungGridDensity = css({
  '@media (min-width: 769px)': {
    '& thead th': {
      position: 'sticky',
      top: 0,
      zIndex: 1,
      padding: `${theme.space.xs} ${theme.space.md} !important`,
    },
    '& tbody td': { padding: `${theme.space.xs} ${theme.space.md} !important` },
  },
})
