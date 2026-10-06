import { css, type CSSMixinDescriptor } from 'remix/component'

import { componentStyleValues as styles } from './style-values.ts'

const popupViewportClampMaxHeight = '50dvh'

const popoverSurfaceTransitionCss: CSSMixinDescriptor = css({
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
})

const popoverSurfaceCss: CSSMixinDescriptor = css({
  position: 'fixed',
  inset: 'auto',
  margin: 0,
  padding: styles.space.none,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: '12rem',
  maxWidth: `min(24rem, calc(100vw - (${styles.space.lg} * 2)))`,
  maxHeight: popupViewportClampMaxHeight,
  border: `1px solid ${styles.colors.border.subtle}`,
  borderRadius: styles.radius.lg,
  backgroundColor: styles.surface.lvl0,
  color: styles.colors.text.primary,
  overflow: 'hidden',
  boxShadow: `${styles.shadow.xs}, ${styles.shadow.md}`,
  '&::backdrop': {
    background: 'transparent',
  },
})

export const popoverSurfaceStyle = [popoverSurfaceCss, popoverSurfaceTransitionCss] as const
