import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const card = {
  base: css({
    background: theme.surface.lvl3,
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.xl,
    padding: theme.space.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.lg,
  }),
}
