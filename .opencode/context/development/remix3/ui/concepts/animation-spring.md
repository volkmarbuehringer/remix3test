<!-- Context: development/remix3/ui/concepts | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Spring Animation

Physics-based spring animation returning a `SpringIterator` with CSS `linear()` easing. Use for natural-feeling motion in CSS transitions or JS animations.

## Core Idea

`spring()` generates a CSS `linear()` easing function based on physics parameters (duration, bounce, velocity). The result stringifies to `{duration}ms linear(...)` for use in CSS `transition` properties.

## Presets

| Preset   | Bounce | Duration | Character |
|----------|--------|----------|-----------|
| `smooth` | -0.3   | 400ms    | Overdamped, no overshoot |
| `snappy` | 0      | 200ms    | Critically damped, quick |
| `bouncy` | 0.3    | 300ms    | Underdamped, visible bounce |

## Quick Examples

```tsx
import { spring } from 'remix/ui/animation'

// CSS transitions
mix={[css({ transition: `transform ${spring('bouncy')}` })]}

// Animation mixins (spread into animateEntrance/Exit)
mix={[animateEntrance({ opacity: 0, ...spring('snappy') })]}

// Custom spring
spring({ duration: 400, bounce: 0.3, velocity: 0 })
```

## Custom Parameters

- `duration` — Perceived duration in ms
- `bounce` — -1 to 1 (negative = overdamped, 0 = critical, positive = bouncy)
- `velocity` — Initial velocity in units/s (for gesture continuation)

## Reference

Full source: `~/remix/packages/ui/src/animation/spring.ts`
Docs: `~/remix/packages/ui/docs/spring.md`
