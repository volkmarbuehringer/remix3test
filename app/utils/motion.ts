import type { animateEntrance } from '@remix-run/ui/animation'

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

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
