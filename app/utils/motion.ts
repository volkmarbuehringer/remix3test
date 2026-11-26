import { prefersReducedMotion, type animateEntrance } from '@remix-run/ui/animation'

// Re-exported so motion call sites keep importing one app-level facade. The
// vendor helper is SSR-safe: it returns false without `window.matchMedia`.
export { prefersReducedMotion }

type AnimationConfig = Parameters<typeof animateEntrance>[0]

export function entrance(config: AnimationConfig): AnimationConfig {
  return prefersReducedMotion() ? false : config
}
