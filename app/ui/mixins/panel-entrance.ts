import { css } from 'remix/component'

/**
 * CSS entrance for server-rendered panels. The keyframes live in the document
 * shell so this runs from server HTML without a clientEntry/hydration boundary;
 * `animateEntrance` from `@remix-run/ui/animation` is `ssr: false` and is
 * therefore inert on plain server page components.
 *
 * The shell's global prefers-reduced-motion rule disables the animation.
 */
export const panelEntrance = css({
  animation: 'app-panel-enter 180ms ease-out both',
})
