<!-- Context: development/remix3/ui/concepts | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Tween Animation

Generator-based tween function for animating values over time with cubic bezier easing. Use for JS-driven animations that need precise control.

## Core Idea

`tween()` returns a generator that yields interpolated values (0→from→to) as timestamps are fed via `next(timestamp)`. Uses cubic bezier curves matching CSS `cubic-bezier()` timing functions.

## Quick Example

```tsx
import { tween, easings } from 'remix/ui/animation'

let animation = tween({
  from: 0, to: 100, duration: 1000,
  curve: easings.easeInOut,
})

animation.next() // Initialize
function animate(ts: number) {
  let { value, done } = animation.next(ts)
  element.style.transform = `translateX(${value}px)`
  if (!done) requestAnimationFrame(animate)
}
requestAnimationFrame(animate)
```

## Easing Presets

`easings.linear`, `easings.ease`, `easings.easeIn`, `easings.easeOut`, `easings.easeInOut` — all match CSS `cubic-bezier()` equivalents.

## Key Points

- Yields current interpolated value on each iteration
- Receives timestamp via `next(timestamp)`
- Returns `done: true` when duration elapsed
- Cubic bezier maps linear time → eased value progress

## Reference

Full source: `~/remix/packages/ui/src/animation/tween.ts`
Docs: `~/remix/packages/ui/docs/tween.md`
