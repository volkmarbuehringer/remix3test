# Tween Animation

**Core Idea**: Generator-based tween for animating values over time with cubic bezier easing. Use for imperative/Canvas animations or when spring physics aren't needed.

**Key Points**:
- `tween({ from, to, duration, curve })` returns a generator yielding interpolated values
- `animation.next(timestamp)` — feed timestamps via `requestAnimationFrame`
- Built-in easings: `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`
- Custom curves: `{ x1, y1, x2, y2 }` matching CSS `cubic-bezier()`
- For most UI animations, prefer animation mixins or CSS transitions with `spring()`

**Minimal Example**:
```tsx
import { tween, easings } from 'remix/ui/animation'
let anim = tween({ from: 0, to: 100, duration: 1000, curve: easings.easeOut })
anim.next()
requestAnimationFrame(function tick(ts) {
  let { value, done } = anim.next(ts)
  element.style.transform = `translateX(${value}px)`
  if (!done) requestAnimationFrame(tick)
})
```

**Reference**: `~/remix/packages/ui/docs/tween.md`
