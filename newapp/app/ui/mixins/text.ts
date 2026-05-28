import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const text = {
  heading: css({
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    lineHeight: theme.lineHeight.tight,
  }),

  body: css({
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.normal,
    color: theme.colors.text.primary,
    lineHeight: theme.lineHeight.relaxed,
  }),

  muted: css({
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.normal,
    color: theme.colors.text.muted,
  }),

  label: css({
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.secondary,
  }),
}
