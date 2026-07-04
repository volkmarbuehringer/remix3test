import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'

export const input = {
  base: css({
    width: '100%',
    padding: `${theme.space.xs} ${theme.space.sm}`,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
    background: theme.surface.lvl0,
    fontFamily: theme.fontFamily.sans,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    '&::placeholder': {
      color: theme.colors.text.muted,
    },
  }),

  focus: css({
    '&:focus': {
      borderColor: theme.colors.action.primary.background,
      boxShadow: `0 0 0 3px ${theme.colors.focus.ring}`,
    },
  }),

  error: css({
    borderColor: theme.colors.action.danger.background,
    '&:focus': {
      borderColor: theme.colors.action.danger.background,
      boxShadow: `0 0 0 3px ${theme.colors.action.danger.background}33`,
    },
  }),
}
