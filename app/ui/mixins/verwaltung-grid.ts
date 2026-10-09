import { css } from 'remix/component'
import { theme } from '../theme/theme.ts'

import { dataGridFill, dataGridWrap } from './data-grid.ts'

/**
 * The Verwaltung data grids (Termine/Angebote/Ressourcen/
 * Angebotskonfigurationen) share the generic bounded-grid fill chain: the shell
 * is height-constrained and only the row region scrolls, so the toolbar and
 * pagination stay pinned. The definitions live in `data-grid.ts`; these aliases
 * keep the Verwaltung-specific names and add the desktop density override.
 */
export { dataGridFill as verwaltungGridFill, dataGridWrap as verwaltungGridWrap }

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
