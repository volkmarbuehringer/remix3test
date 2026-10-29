import { css } from 'remix/component'
import { theme } from '../theme/theme.ts'

/**
 * Per-row action cluster shared by the admin grids and the filesystem upload
 * page. Download is always first and delete second, so the outer corners are
 * rounded on each side and the shared border acts as the divider.
 */
export const rowActions = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 0,
})

/** 24px square icon button (the WCAG 2.2 minimum target size). */
export const iconAction = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  minWidth: '24px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: `${theme.radius.md} 0 0 ${theme.radius.md}`,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

export const iconActionDanger = css({
  color: theme.colors.action.danger.background,
  borderColor: 'transparent',
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})
