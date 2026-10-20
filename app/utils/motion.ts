import { prefersReducedMotion, type animateEntrance } from '@remix-run/ui/animation'

// Re-exported so motion call sites keep importing one app-level facade. The
// vendor helper is SSR-safe: it returns false without `window.matchMedia`.
export { prefersReducedMotion }

type AnimationConfig = Parameters<typeof animateEntrance>[0]

export function entrance(config: AnimationConfig): AnimationConfig {
  return prefersReducedMotion() ? false : config
}

/**
 * Reduced-motion-aware config for animateExit(). `false` disables the mixin
 * so the node is removed immediately instead of lingering for an animation.
 */
export function exit(config: AnimationConfig): AnimationConfig {
  return prefersReducedMotion() ? false : config
}
