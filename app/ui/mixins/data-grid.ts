import { css } from 'remix/component'

/**
 * Fill chain for a bounded data grid. The page becomes a flex column that fills
 * the shell; the toolbar/header stays put and only the row region scrolls, so
 * the pagination controls never move when a page's row heights change.
 *
 * `flex: 1 1 auto` (not `flex: 1`) so the same classes are safe when the page is
 * NOT in a bounded shell (frame fragments / agent panels): a content-sized
 * flex column would collapse a `flex-basis: 0` child to zero height.
 */
export const dataGridFill = css({
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
})

export const dataGridWrap = css({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  // Reserve the scrollbar gutter: variable row heights toggle this region's
  // scrollbar, and without the reservation the whole table shifts sideways.
  scrollbarGutter: 'stable',
})
