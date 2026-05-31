# Spring Animation

**Core Idea**: Physics-based spring animation returning an iterator with CSS `linear()` easing values. Use for CSS transitions, WAAPI, or JS-driven animations.

**Key Points**:
- Presets: `smooth` (overdamped, -0.3), `snappy` (critical, 0), `bouncy` (underdamped, 0.3)
- Returns `{ duration, easing, toString() }` — stringifies to CSS transition value
- `spring.transition('width', 'bouncy')` — helper for CSS transition shorthand
- Spread into animation mixins: `animateEntrance({ ...spring('bouncy') })`
- Custom: `spring({ duration: 500, bounce: 0.3, velocity: 0 })`
- Bounce < 0 = overdamped, = 0 = critical, > 0 = underdamped/overshoot

**Minimal Example**:
```tsx
mix={[css({ transition: `transform ${spring('bouncy')}` })]}
// → "transform 550ms linear(...)"
```

**Reference**: `~/remix/packages/ui/docs/spring.md`
