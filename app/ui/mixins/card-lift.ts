import { spring } from '@remix-run/ui/animation'
import { theme } from '../theme/theme.ts'

/**
 * Shared interactive-card hover lift. Spread into a `css({ ...cardLift })`
 * call (plain style object, not a mixin, so it composes with the existing
 * `...cardBaseCss` spreads in admin-page.tsx and verwaltung-page.tsx).
 *
 * Uses spring timing per the animation guide (guides.remix.run/animation).
 * Movement is disabled globally under prefers-reduced-motion by the shell
 * rule in app/ui/document.tsx, so no per-component media query is needed.
 */
export const cardLift = {
  transition: `transform ${spring('snappy')}, box-shadow ${spring('snappy')}, border-color ${spring('snappy')}`,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadow.md,
    borderColor: theme.colors.action.primary.background,
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}
