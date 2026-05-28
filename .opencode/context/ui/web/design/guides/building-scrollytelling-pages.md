<!-- Context: ui/building-scrollytelling-pages | Priority: high | Version: 1.1 | Updated: 2026-04-12 -->

# Building Scrollytelling Pages

Scroll-linked image sequence animations.

## Prerequisites

- Next.js 14+ with App Router
- Framer Motion installed
- Tailwind CSS configured
- Image sequence ready (60-240 WebP frames)

---

## Key Steps

1. **Generate frames**: AI tools create start/end, interpolate to video, export WebP
2. **Install canvas**: `npm i canvas-confetti` for victory animation
3. **Create component**: Use Framer Motion `useScroll`, `useTransform`
4. **Optimize images**: Use Next.js Image, consider lazy loading

---

## Minimal Example

```typescript
import { motion, useScroll, useTransform } from 'framer-motion'

export function Scrollytelling() {
  const { scrollYProgress } = useScroll()
  const imageIndex = useTransform(scrollYProgress, [0, 1], [0, maxFrame])

  return (
    <motion.img
      src={`/frames/frame_${imageIndex}.webp`}
      style={{ opacity: imageIndex }}
    />
  )
}
```

---

## Reference

- Framer Motion: https://www.framer.com/motion/
- Image optimization: Next.js Image docs
