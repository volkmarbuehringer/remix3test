import type { animateEntrance } from 'remix/ui/animation'

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

type AnimationConfig = Parameters<typeof animateEntrance>[0]

export function entrance(config: AnimationConfig): AnimationConfig {
  return prefersReducedMotion() ? false : config
}
