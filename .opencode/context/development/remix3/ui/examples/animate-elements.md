# Example: Animating Elements

**Core Idea**: Use animation mixins from `remix/ui` for enter/exit/layout transitions.

## Quick Start

```tsx
import { animateEntrance, animateExit, animateLayout, spring } from 'remix/ui'

<div
  key="card"
  mix={[
    animateEntrance({ opacity: 0, transform: 'scale(0.95)', ...spring('snappy') }),
    animateExit({ opacity: 0, duration: 120, easing: 'ease-in' }),
    animateLayout({ duration: 220, easing: 'ease-out' }),
  ]}
/>
```

## Enter-only Element

```tsx
<div mix={[animateEntrance({
  opacity: 0,
  transform: 'translateY(8px)',
  duration: 180,
  easing: 'ease-out',
})]} />
```

## Toggle Visibility (Enter + Exit)

```tsx
{isVisible && (
  <div
    key="panel"
    mix={[
      animateEntrance({ opacity: 0, transform: 'scale(0.98)', duration: 180 }),
      animateExit({ opacity: 0, duration: 120, easing: 'ease-in' }),
    ]}
  />
)}
```

## Reordering/List Layout

```tsx
{items.map((item) => (
  <li
    key={item.id}
    mix={[animateLayout({ ...spring({ duration: 500, bounce: 0.2 }) })]}
  />
))}
```

## Shared-Layout Swap

```tsx
<div
  mix={[
    css({
      display: 'grid',
      '& > *': { gridArea: '1 / 1' },
    }),
  ]}
>
  {state ? (
    <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  ) : (
    <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
  )}
</div>
```

## Practical Guidance

- Always key conditional/switching elements needing transition
- Use `animateLayout` on element whose position/size changes
- Prefer one clear intent per mixin
- Use `spring(...)` for default timing
