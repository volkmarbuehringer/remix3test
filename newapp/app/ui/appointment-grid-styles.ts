import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { LABEL_WIDTH, HOURS, SLOT_HEIGHT, SUB_SLOT_HEIGHT } from './appointment-grid-types.ts'

export const gridWrapperStyle = css({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  '&[data-dragging="true"], &[data-dragging="true"] *': {
    cursor: 'grabbing !important',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  '&[data-resizing="true"], &[data-resizing="true"] *': {
    cursor: 'ns-resize !important',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
})

export const headerRowStyle = css({
  display: 'grid',
  gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, 1fr)`,
  borderBottom: `1px solid ${theme.colors.border.strong}`,
  backgroundColor: theme.surface.lvl0,
  position: 'sticky',
  top: 0,
  zIndex: 2,
})

export const cornerCellStyle = css({
  alignItems: 'center',
  borderRight: `1px solid ${theme.colors.border.subtle}`,
  display: 'flex',
  justifyContent: 'center',
  padding: `${theme.space.xs} 0`,
})

export const dayHeaderStyle = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '0px',
  padding: `${theme.space.xs} 0`,
  textAlign: 'center',
})

export const dayNameStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
})

export const dayDateStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xxs,
})

export const gridBodyStyle = css({
  display: 'grid',
  gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, 1fr)`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  position: 'relative',
})

export const timeColumnStyle = css({
  position: 'relative',
})

export const timeSlotRowStyle = css({
  height: `${SUB_SLOT_HEIGHT}px`,
  position: 'relative',
})

export const timeLabelStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxs,
  paddingRight: theme.space.xs,
  position: 'absolute',
  right: 0,
  top: '-6px',
})

export const subTimeLabelStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xxs,
  paddingRight: theme.space.xs,
  position: 'absolute',
  right: 0,
  top: '-3px',
  opacity: 0.4,
})

export const dayColumnStyle = css({
  borderLeft: `1px solid ${theme.colors.border.subtle}`,
  minHeight: `${HOURS * SLOT_HEIGHT}px`,
  position: 'relative',
})

export const hourLineStyle = css({
  borderTop: `1px solid ${theme.colors.border.default}`,
  height: `${SUB_SLOT_HEIGHT}px`,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
})

export const subHourLineStyle = css({
  borderTop: `1px dashed ${theme.colors.border.subtle}`,
  height: `${SUB_SLOT_HEIGHT}px`,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
})

export const blockBoxStyle = css({
  alignItems: 'center',
  backgroundColor: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.sm,
  boxShadow: theme.shadow.xs,
  color: theme.colors.text.primary,
  cursor: 'pointer',
  display: 'flex',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  justifyContent: 'center',
  left: '2px',
  margin: '1px 0',
  overflow: 'hidden',
  padding: `0 ${theme.space.xs}`,
  position: 'absolute',
  right: '2px',
  textAlign: 'center',
  touchAction: 'none',
  zIndex: 1,
})

export const foreignBlockStyle = css({
  backgroundColor: 'rgb(243 232 255 / 0.8)',
  borderColor: 'rgb(192 132 252)',
  color: 'rgb(107 33 168)',
  cursor: 'default',
})

export const draggingBlockStyle = css({
  opacity: 0.6,
  zIndex: 4,
  transition: 'none !important',
  pointerEvents: 'none',
})

export const blockTitleStyle = css({
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
})

export const adminBlockInnerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
})

export const adminEmailStyle = css({
  fontSize: '10px',
  lineHeight: 1.2,
  color: theme.colors.text.secondary,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  padding: '1px 0',
})

export const hoveredBlockStyle = css({
  boxShadow: theme.shadow.md,
  overflow: 'visible',
  transition: 'box-shadow 0.15s ease, overflow 0.15s ease',
  zIndex: 10,
})

export const expandedTitleStyle = css({
  display: 'block',
  overflow: 'visible',
  whiteSpace: 'pre-wrap',
})

export const editingBlockStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  overflow: 'visible',
  padding: '4px',
  gap: '4px',
  zIndex: 11,
})

export const hiddenStyle = css({
  display: 'none',
})

export const inputStyle = css({
  background: 'transparent',
  border: 0,
  color: theme.colors.text.primary,
  font: 'inherit',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  lineHeight: theme.lineHeight.tight,
  minHeight: '32px',
  outline: 'none',
  overflowY: 'auto',
  padding: `${theme.space.px} 0`,
  resize: 'none',
  textAlign: 'center',
  whiteSpace: 'pre-wrap',
  width: '100%',
  wordBreak: 'break-word',
})

export const draftBlockStyle = css({
  backgroundColor: theme.surface.lvl1,
  border: `2px dashed ${theme.colors.text.secondary}`,
  borderRadius: theme.radius.md,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  left: '2px',
  margin: '1px 0',
  opacity: 0.85,
  padding: '6px 4px',
  position: 'absolute',
  right: '2px',
  zIndex: 3,
})

export const draftButtonsStyle = css({
  display: 'flex',
  gap: '4px',
  justifyContent: 'flex-end',
})

export const draftSaveButtonStyle = css({
  background: theme.colors.action.primary.background,
  border: 0,
  borderRadius: theme.radius.sm,
  color: theme.colors.action.primary.foreground,
  cursor: 'pointer',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  padding: '2px 8px',
})

export const draftCancelButtonStyle = css({
  background: 'transparent',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontSize: theme.fontSize.xs,
  lineHeight: theme.lineHeight.normal,
  padding: '2px 8px',
})

export const ghostBlockStyle = css({
  backgroundColor: 'rgb(209 213 219 / 0.72)',
  border: `2px dashed ${theme.colors.text.secondary}`,
  borderRadius: theme.radius.md,
  left: '2px',
  margin: '1px 0',
  opacity: 0.5,
  position: 'absolute',
  right: '2px',
  pointerEvents: 'none',
  zIndex: 2,
})

export const typeDragGhostStyle = css({
  backgroundColor: 'rgb(147 197 253 / 0.5)',
  border: `2px dashed ${theme.colors.action.primary.background}`,
  borderRadius: theme.radius.md,
  left: '2px',
  margin: '1px 0',
  opacity: 0.55,
  position: 'absolute',
  right: '2px',
  pointerEvents: 'none',
  zIndex: 2,
})

export const resizeHandleStyle = css({
  cursor: 'ns-resize',
  height: '12px',
  left: theme.space.xs,
  opacity: 0,
  position: 'absolute',
  right: theme.space.xs,
  touchAction: 'none',
  zIndex: 3,
  '&::before': {
    backgroundColor: theme.colors.focus.ring,
    borderRadius: '999px',
    content: '""',
    height: '3px',
    left: '50%',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '28px',
  },
  '&:hover': {
    opacity: 1,
  },
})

export const activeResizeHandleStyle = css({
  opacity: 1,
})

export const startResizeHandleStyle = css({
  top: 0,
  transform: 'translateY(-4px)',
})

export const endResizeHandleStyle = css({
  bottom: 0,
  transform: 'translateY(4px)',
})

export const trashcanZoneStyle = css({
  alignItems: 'center',
  backgroundColor: 'transparent',
  borderRadius: theme.radius.sm,
  color: theme.colors.text.muted,
  display: 'flex',
  height: '100%',
  justifyContent: 'center',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 0.2s, background-color 0.2s, color 0.2s',
  width: '100%',
})

export const trashcanVisibleStyle = css({
  opacity: 1,
  pointerEvents: 'auto',
})

export const trashcanHoverStyle = css({
  backgroundColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
})

export const nonOfferingSlotStyle = css({
  backgroundColor: 'rgb(254 226 226 / 0.55)',
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 8px, rgb(252 165 165 / 0.3) 8px, rgb(252 165 165 / 0.3) 16px)',
  cursor: 'default',
  borderTop: `1px solid rgb(252 165 165 / 0.6)`,
  '&:hover': {
    backgroundColor: 'rgb(252 165 165 / 0.5)',
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 8px, rgb(239 68 68 / 0.25) 8px, rgb(239 68 68 / 0.25) 16px)',
  },
})

export const emptyStateWrapperStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  padding: theme.space.xl,
})

export const emptyStateTextStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.md,
})

export const ssrPlaceholderWrapper = css({
  minHeight: '200px',
})
