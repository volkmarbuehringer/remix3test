import { css } from 'remix/ui'

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

export const tagChipStyle = css({
  color: theme.colors.text.primary,
  borderColor: theme.colors.border.default,
  backgroundColor: theme.surface.lvl2,
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
    case 'low':
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
})

export const panelFilterInputStyle = css({
  maxWidth: '260px',
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

export const bulkSelectStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.strong}`,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.xs,
  maxWidth: '220px',
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
// outer corners. Each button carries its own style (the remix-ui css()
// runtime won't emit descendant `> button` group selectors, so we apply the
// styles per-button instead of via a container rule).
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
  // On touch devices there is no hover, so the reveal-on-hover cluster would
  // be unreachable — keep the row actions visible and interactive instead.
  '@media (hover: none)': {
    opacity: 1,
    pointerEvents: 'auto',
  },
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
