import type { animateEntrance } from '@remix-run/ui/animation'

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

type AnimationConfig = Parameters<typeof animateEntrance>[0]

export function entrance(config: AnimationConfig): AnimationConfig {
  return prefersReducedMotion() ? false : config
}
