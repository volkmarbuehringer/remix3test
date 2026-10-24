import { css } from 'remix/component'

import { theme } from '../../../ui/theme/theme.ts'

import type { ItemPriority } from './lists-state.ts'

export const multilineDisplayStyle = css({
  // The label is a child of the column `itemMainStyle` now, so it must not
  // flex-grow: with flex-basis: 0% and overflow: hidden it collapses to 0px
  // and hides the text. It sizes to its content, clamped to two lines so one
  // long item can't eat three rows of height, and fills the column width via
  // the default align-self: stretch.
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.primary,
  display: '-webkit-box',
  // Must be a *string*: the css() runtime appends `px` to numeric values for
  // every property outside its unitless allowlist, and `-webkit-line-clamp:
  // 2px` is invalid CSS that the browser silently drops — which is why the
  // clamp never took effect and long labels grew to five lines.
  WebkitLineClamp: '2',
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
})

export const gripStyle = css({
  cursor: 'grab',
  padding: '0 6px',
  userSelect: 'none',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.lg,
  lineHeight: 1,
  '&:active': {
    cursor: 'grabbing',
  },
  '&:hover': {
    color: theme.colors.text.primary,
  },
})

// Per-item metadata layout. The label + metadata line live in a flex column
// so the badges wrap under the label instead of squeezing it sideways.
export const itemMainStyle = css({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
})

/**
 * On touch the edit form spans the full row width below the row controls.
 * Leaving it in the 100–150px column next to the two checkboxes made the
 * textarea and the metadata fields unusably narrow.
 */
export const itemEditMainStyle = css({
  '@media (hover: none)': {
    flexBasis: '100%',
    marginTop: theme.space.xs,
  },
})

export const metaRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.xs,
  marginTop: '0.25rem',
})

export const metaBadgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 7px',
  borderRadius: theme.radius.full,
  border: '1px solid transparent',
  fontSize: theme.fontSize.xs,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
})

export const dueBadgeStyle = css({
  color: theme.colors.text.secondary,
  borderColor: theme.colors.border.default,
  backgroundColor: theme.surface.lvl2,
})

// Overdue due-dates read as a warning tint on the badge itself.
export const overdueBadgeStyle = css({
  color: theme.colors.action.danger.background,
  borderColor: theme.colors.action.danger.border,
  backgroundColor: theme.colors.action.danger.background + '0f',
})

export const tagChipStyle = css({
  color: theme.colors.text.primary,
  borderColor: theme.colors.border.default,
  backgroundColor: theme.surface.lvl2,
})

// Tag chips double as filter shortcuts, so they render as buttons; reset the
// UA button defaults that would fight the chip look (metaBadgeStyle).
export const tagChipButtonStyle = css({
  cursor: 'pointer',
  font: 'inherit',
  '&:hover': {
    backgroundColor: theme.surface.lvl3,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '1px',
  },
})

// Editing surface: the label textarea plus a metadata editor row
// (priority / due date / tags), all inside the column that takes flex: 1.
export const editTextareaStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.focus.ring}`,
  width: '100%',
  boxSizing: 'border-box',
  fontSize: theme.fontSize.lg,
  outline: 'none',
  fontFamily: theme.fontFamily.sans,
  minHeight: '60px',
  resize: 'vertical',
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
})

export const metaEditorStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginTop: theme.space.sm,
})

export const metaFieldStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.strong}`,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.sans,
  backgroundColor: theme.surface.lvl1,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
})

export const priorityBadge = (p: ItemPriority) => {
  switch (p) {
    case 'high':
      return css({
        color: theme.colors.action.danger.background,
        borderColor: theme.colors.action.danger.border,
        backgroundColor: theme.colors.action.danger.background + '0f',
      })
    case 'medium':
      return css({
        color: theme.colors.warning.foreground,
        borderColor: theme.colors.warning.border,
        backgroundColor: theme.colors.warning.background,
      })
    default:
      return css({
        color: theme.colors.text.secondary,
        borderColor: theme.colors.border.strong,
        backgroundColor: theme.surface.lvl0,
      })
  }
}

// ── Editor surface: a single centered card with a header + body ──────────
export const cardStyle = css({
  fontFamily: theme.fontFamily.sans,
  // Fill the content column (up to a cap) so the card uses the available
  // width instead of leaving a large gap on either side. `margin: 0 auto`
  // still centers it; the `calc(100% - 2rem)` keeps a small 1rem gutter on
  // each edge while the card never exceeds the cap.
  maxWidth: 'min(1000px, calc(100% - 2rem))',
  width: '100%',
  // Content-sized card: it hugs the editor's actual content so a short list
  // shows no dead space. `maxHeight: 100%` + the `lg` bottom margin caps it
  // at the sidebar's height (the flex column shrinks the card to fit), and
  // the `min-height: 0` chain below lets a long element list scroll
  // internally instead of overflowing the card.
  maxHeight: '100%',
  margin: `0 auto ${theme.space.lg}`,
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.sm,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
})

export const cardHeaderStyle = css({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.space.md,
  flexWrap: 'wrap',
  // Tighter vertical padding: the header's own 16px bottom padding stacked
  // on the body's 16px top padding left a flat ~33px band between the title
  // and the first body row.
  padding: `${theme.space.sm} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  backgroundColor: theme.surface.lvl2,
  // On a phone the action cluster (`flexShrink: 0`) used to compete with the
  // title for the single header line. The title wrap then collapsed to a few
  // pixels (the new-list title input measured 8px at 390px). Stack the two
  // groups so the title always gets the full width and the actions wrap below.
  '@media (max-width: 768px)': {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: theme.space.sm,
  },
})

export const cardTitleWrapStyle = css({ flex: 1, minWidth: 0 })

// Small eyebrow above the title so the editor always states which list is
// open — the title field itself may be empty, and the sidebar selection is
// easy to miss.
export const listContextStyle = css({
  display: 'block',
  marginBottom: theme.space.xs,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

export const titleHeadingStyle = css({ margin: 0, lineHeight: 1.2 })

export const titleInputStyle = css({
  width: '100%',
  padding: `0 0 ${theme.space.xs} 0`,
  border: 'none',
  borderBottom: '2px solid transparent',
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  outline: 'none',
  fontFamily: theme.fontFamily.sans,
  boxSizing: 'border-box',
  backgroundColor: 'transparent',
  color: theme.colors.text.primary,
  transition: 'border-color 120ms ease',
  '&:focus': {
    borderBottomColor: theme.colors.focus.ring,
  },
  '&::placeholder': {
    color: theme.colors.text.muted,
    fontWeight: theme.fontWeight.semibold,
  },
  // The xl title overflowed its 292px field at 390px. A step down keeps the
  // full title readable without changing the desktop hierarchy.
  '@media (max-width: 768px)': {
    fontSize: theme.fontSize.lg,
  },
})

export const visuallyHiddenStyle = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
})

export const cardHeaderActionsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexShrink: 0,
  // Below the title on phones; let the secondary actions wrap instead of
  // pushing the save-status pill off-screen.
  '@media (max-width: 768px)': {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
})

export const cardBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  // Auto basis (not `flex: 1` = basis 0) so the body's content contributes
  // to the card's natural height (keeping the card content-sized), while it
  // still shrinks when tall so the element list can scroll internally.
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
  // Tighter top padding so the first body row (the description or the
  // add-element field) sits close under the header instead of leaving a
  // band of empty card between the title and "Beschreibung".
  padding: theme.space.md,
  paddingTop: theme.space.sm,
})

// ── ELEMENTE panel toolbar ───────────────────────────────────────────────
// A single compact row carrying the element filter, the reorder controls and
// the item counter. These controls previously occupied a separate list
// toolbar above the description plus a dedicated filter row, costing ~120px
// of vertical space that now goes to element rows instead.
export const panelHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  backgroundColor: theme.surface.lvl2,
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

export const panelLeftStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  flex: 1,
  minWidth: '160px',
})

export const panelRightStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  marginLeft: 'auto',
  // The right-hand controls (sort, reorder, help, progress, count, menu) do
  // not fit one 294px line. Give the group its own wrapped row under the
  // filter instead of letting it overflow the card and clip the counter.
  '@media (max-width: 768px)': {
    flexWrap: 'wrap',
    marginLeft: 0,
    rowGap: theme.space.xs,
    width: '100%',
  },
})

export const panelFilterInputStyle = css({
  maxWidth: '260px',
  // Let the in-list search take the remaining width next to the select-all
  // checkbox on a phone; a fixed 260px max pushed the control row wide.
  '@media (max-width: 768px)': {
    flex: 1,
    maxWidth: 'none',
  },
})

// Compact square buttons for Umkehren / Mischen / Tastatur-Hilfe.
export const iconToolbarBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '26px',
  height: '26px',
  padding: 0,
  border: `1px solid ${theme.colors.border.strong}`,
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: 1,
  ':hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
  '&[aria-pressed="true"]': {
    background: theme.colors.action.primary.background,
    borderColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
  },
  // 26px is below the WCAG 2.2 minimum target on touch; grow the hit area
  // without changing the glyph.
  '@media (hover: none)': {
    width: '44px',
    height: '44px',
  },
})

// Explicit pressed style for the reverse toggle. Applied conditionally from
// the view as well as via the attribute selector so the state is visible even
// if a runtime drops the nested attribute rule.
export const pressedControlStyle = css({
  background: theme.colors.action.primary.background,
  borderColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
})

// On touch, the reverse/shuffle/help controls move into the "…" menu so the
// toolbar stays two rows at 390px. Desktop keeps the visible 26px cluster.
export const touchOnlyToolbarActionStyle = css({
  display: 'inline-flex',
  '@media (max-width: 768px)': {
    display: 'none',
  },
})

export const touchOnlyMenuActionStyle = css({
  display: 'none',
  width: '100%',
  minHeight: '44px',
  justifyContent: 'center',
  '@media (max-width: 768px)': {
    display: 'flex',
  },
  '&[aria-pressed="true"]': {
    background: theme.colors.action.primary.background,
    borderColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
  },
})

export const shortcutListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

export const shortcutRowStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: theme.space.sm,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

export const shortcutKeyStyle = css({
  flexShrink: 0,
  minWidth: '6.5rem',
  padding: '2px 6px',
  borderRadius: theme.radius.sm,
  border: '1px solid ' + theme.colors.border.default,
  background: theme.surface.lvl2,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
})

// "…" overflow menu that holds the destructive list actions so they stay out
// of the everyday toolbar and out of the way.
export const menuDetailsStyle = css({
  position: 'relative',
})

export const menuSummaryStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '26px',
  height: '26px',
  border: `1px solid ${theme.colors.border.strong}`,
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  listStyle: 'none',
  fontSize: theme.fontSize.sm,
  userSelect: 'none',
  ':hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
  '@media (hover: none)': {
    width: '44px',
    height: '44px',
  },
})

export const menuPanelStyle = css({
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.sm,
  minWidth: '230px',
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.default}`,
  backgroundColor: theme.surface.lvl1,
  boxShadow: theme.shadow.md,
})

export const countTextStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  whiteSpace: 'nowrap',
})

// "Alle löschen" is quiet (danger-coloured text on a neutral button) until
// the first click arms it, at which point it turns into a solid danger
// button so the confirmation is impossible to miss.
export const dangerTextStyle = css({
  color: theme.colors.action.danger.background,
})

export const dangerArmedStyle = css({
  backgroundColor: theme.colors.action.danger.background,
  borderColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
})

// The two checkbox columns do different jobs, so size and accent colour —
// not just column position — must tell them apart at a glance. The row
// selection box (also the header's select-all) is the smaller, blue pick
// control; checking it never marks the list dirty.
export const selectionCheckboxStyle = css({
  width: '15px',
  height: '15px',
  flexShrink: 0,
  cursor: 'pointer',
  accentColor: theme.colors.focus.ring,
  // A 15px checkbox is not a viable touch target. Stay above the WCAG 2.2
  // 24x24 minimum while keeping the completion box visibly larger.
  '@media (hover: none)': {
    width: '24px',
    height: '24px',
  },
})

// The completion toggle is the larger, green status control. Its size and
// colour deliberately differ from the selection box so the two checkbox
// columns can never be confused.
export const doneCheckboxStyle = css({
  width: '22px',
  height: '22px',
  flexShrink: 0,
  cursor: 'pointer',
  accentColor: theme.colors.success.foreground,
  '@media (hover: none)': {
    width: '30px',
    height: '30px',
  },
})

// Bulk-action bar, shown only while at least one row is selected.
export const bulkBarStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  flexWrap: 'wrap',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  backgroundColor: theme.surface.lvl3,
})

export const bulkCountStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  whiteSpace: 'nowrap',
})

export const bulkNoticeStyle = css({
  padding: `${theme.space.xs} ${theme.space.md}`,
  fontSize: theme.fontSize.xs,
  color: theme.colors.success.foreground,
  backgroundColor: theme.surface.lvl1,
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

export const bulkErrorStyle = css({
  padding: `${theme.space.xs} ${theme.space.md}`,
  fontSize: theme.fontSize.xs,
  color: theme.colors.action.danger.background,
  backgroundColor: theme.surface.lvl1,
  borderBottom: `1px solid ${theme.colors.border.default}`,
})

// ── Target picker dialog ──────────────────────────────────────────────────
// A searchable, session-backed list picker shared by bulk copy/move and the
// single-row move action. Fixed overlay so it is never clipped by the element
// list's scroll container; every interactive target is at least 44px tall.
export const targetPickerOverlayStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.space.lg,
  background: 'rgba(0, 0, 0, 0.45)',
})

export const targetPickerDialogStyle = css({
  width: '100%',
  maxWidth: '460px',
  maxHeight: 'min(80vh, 640px)',
  display: 'flex',
  flexDirection: 'column',
  background: theme.surface.lvl0,
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.lg,
  boxShadow: theme.shadow.md,
  overflow: 'hidden',
})

export const targetPickerHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: theme.space.sm + ' ' + theme.space.md,
  borderBottom: '1px solid ' + theme.colors.border.default,
})

export const targetPickerTitleStyle = css({
  margin: 0,
  flex: 1,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

export const targetPickerCloseStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  padding: 0,
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontSize: theme.fontSize.lg,
  lineHeight: 1,
})

export const targetPickerBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  padding: theme.space.md,
  minHeight: 0,
  overflow: 'hidden',
})

export const targetPickerSearchStyle = css({
  width: '100%',
  height: '44px',
  padding: '0 ' + theme.space.sm,
  borderRadius: theme.radius.md,
  border: '1px solid ' + theme.colors.border.strong,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  boxSizing: 'border-box',
})

export const targetPickerResultsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  minHeight: 0,
  overflowY: 'auto',
})

export const targetPickerOptionStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  width: '100%',
  minHeight: '44px',
  padding: theme.space.xs + ' ' + theme.space.sm,
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  textAlign: 'left',
  cursor: 'pointer',
  boxSizing: 'border-box',
  '&:hover, &:focus-visible': {
    background: theme.surface.lvl3,
    borderColor: theme.colors.focus.ring,
  },
})

export const targetPickerOptionLabelStyle = css({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const targetPickerMetaStyle = css({
  flexShrink: 0,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

export const targetPickerStateStyle = css({
  margin: 0,
  padding: theme.space.sm,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

export const targetPickerHintStyle = css({
  margin: 0,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

export const sortSelectStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.strong}`,
  fontSize: theme.fontSize.xs,
  backgroundColor: theme.surface.lvl1,
  color: theme.colors.text.primary,
  cursor: 'pointer',
  fontFamily: theme.fontFamily.sans,
  maxWidth: '150px',
  '&:focus': {
    outline: 'none',
    borderColor: theme.colors.focus.ring,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
  '@media (hover: none)': {
    minHeight: '44px',
  },
})

// View-only sort marker: the select never rewrites the persisted order.
export const viewOnlyHintStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 6px',
  borderRadius: theme.radius.full,
  backgroundColor: theme.surface.lvl2,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
})

/**
 * Compact status filter strip. It wraps instead of overflowing on phones; the
 * hide-done shortcut is a label so the whole text is a touch target.
 */
export const statusBarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: `0 ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  backgroundColor: theme.surface.lvl0,
  '@media (max-width: 768px)': {
    padding: `0 ${theme.space.xs}`,
  },
})

export const statusTabsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '2px',
})

export const statusTabStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  minHeight: '44px',
  padding: `0 ${theme.space.sm}`,
  border: 'none',
  borderRadius: theme.radius.sm,
  backgroundColor: 'transparent',
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  ':hover': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&[aria-pressed="true"]': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '-2px',
  },
  '@media (max-width: 768px)': {
    padding: '0 2px',
    gap: '2px',
  },
})

export const statusCountStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '16px',
  height: '18px',
  padding: '0 3px',
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.border.default,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
})

export const hideDoneLabelStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  minHeight: '44px',
  marginLeft: 'auto',
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

export const resetFiltersStyle = css({
  display: 'inline-flex',
  marginTop: theme.space.md,
})

// In-list search lives inline in the ELEMENTE toolbar; Escape clears it.
export const filterInputStyle = css({
  width: '100%',
  minWidth: 0,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.strong}`,
  fontSize: theme.fontSize.xs,
  outline: 'none',
  fontFamily: theme.fontFamily.sans,
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl1,
  color: theme.colors.text.primary,
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
  '&::placeholder': {
    color: theme.colors.text.muted,
  },
})

// ── Collapsible description ──────────────────────────────────────────────
// Hidden for lists without a description so the space goes to element rows.
export const descriptionHeadStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: theme.space.xs,
})

export const descriptionLabelStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
})

export const collapseBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

export const descriptionTextareaStyle = css({
  width: '100%',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.strong}`,
  fontSize: theme.fontSize.sm,
  outline: 'none',
  fontFamily: theme.fontFamily.sans,
  boxSizing: 'border-box',
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  minHeight: '38px',
  resize: 'vertical',
  '&:focus': {
    borderColor: theme.colors.focus.ring,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
  '&::placeholder': {
    color: theme.colors.text.muted,
  },
})

export const showDescriptionBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.fontFamily.sans,
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

export const clearFilterBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  padding: 0,
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

// Item row action cluster is hidden until the row is hovered/focused. It is
// absolutely positioned over the right edge of the row so the row content
// (the label) can span the full row width — the actions never consume layout
// space, letting rows be longer. The buttons are joined into a flat button
// group (matching /admin/lists): square, shared border, rounded only on the
// outer corners. Each button currently carries its own style; the vendor
// runtime now emits descendant selectors (`& > form > button`), so this can be
// collapsed into one container rule when the file is next touched.
export const itemActionsStyle = css({
  position: 'absolute',
  top: '50%',
  right: theme.space.sm,
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'stretch',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 0.12s ease',
  // Touch devices get the row menu (the kebab below) instead of this
  // hover-reveal cluster. Removing it from layout keeps the row dense and
  // lets the label use the full width.
  '@media (hover: none)': {
    display: 'none',
  },
})

// Edit mode has its own two-button cluster (save / cancel). It is always
// visible while editing; on touch it sits below the editor instead of
// overlaying it, mirroring the old touch treatment without hiding the row.
export const itemEditActionsStyle = css({
  position: 'absolute',
  top: '50%',
  right: theme.space.sm,
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'stretch',
  opacity: 1,
  pointerEvents: 'auto',
  transition: 'opacity 0.12s ease',
  '@media (hover: none)': {
    position: 'static',
    transform: 'none',
    justifyContent: 'flex-end',
    marginTop: theme.space.xs,
    width: '100%',
  },
})

/**
 * Touch-only row menu trigger. The four hover actions are replaced by one
 * kebab so the row stays one line high; the menu itself opens inline below
 * the row (no clipping inside the scrolling element list).
 */
export const itemMenuButtonStyle = css({
  display: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  padding: 0,
  flexShrink: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontSize: theme.fontSize.lg,
  lineHeight: 1,
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
  '&[aria-expanded="true"]': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
  '@media (hover: none)': {
    display: 'inline-flex',
  },
})

/** Full-width row under the item, only rendered while its menu is open. */
export const itemMenuStyle = css({
  flexBasis: '100%',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.space.xs,
  paddingTop: theme.space.xs,
})

export const itemMenuItemStyle = css({
  justifyContent: 'center',
  minHeight: '44px',
  width: '100%',
})

// Flat square button-group member — mirrors /admin/lists' iconActionStyle.
// Every button drops its right border so adjacent buttons share one. Radius
// is applied separately (first = left, last = right) so middle buttons stay
// perfectly square.
export const iconActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRight: 'none',
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
  // 30px buttons are hard to hit on a phone; 44px is the recommended touch
  // target. On touch this only renders the edit-mode save/cancel group (the
  // view cluster is replaced by the row menu).
  '@media (hover: none)': {
    width: '44px',
    height: '44px',
  },
})

// First button in the group gets the left radius.
export const iconActionFirstStyle = css({
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
})

// Last button in the group restores its right border + right radius.
export const iconActionLastStyle = css({
  borderRight: `1px solid ${theme.colors.border.default}`,
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
})

// Danger (delete) button — mirrors /admin/lists' iconActionDangerStyle.
export const iconActionDangerStyle = css({
  color: theme.colors.action.danger.background,
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})
