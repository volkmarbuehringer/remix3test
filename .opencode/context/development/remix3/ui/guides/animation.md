# Guide: Animation

**Core Idea**: Use animation mixins (`animateEntrance`, `animateExit`, `animateLayout`) from `remix/ui` to add enter/exit and layout transitions.

**Key Points**:
- Always key conditional or switching elements for transitions
- Use `animateLayout` only on moving or resizing nodes
- Spread `spring(...)` for duration/easing defaults
- Keep DOM work in `handle.queueTask()` or `ref()`, not render math

**Quick Examples**:
```tsx
// Enter animation
<div mix={[animateEntrance({ opacity: 0, transform: 'translateY(8px)', duration: 180 })]} />

// Enter + exit toggle
{isVisible && (
  <div key="panel" mix={[
    animateEntrance({ opacity: 0, transform: 'scale(0.98)', duration: 180 }),
    animateExit({ opacity: 0, transform: 'scale(0.98)', duration: 120, easing: 'ease-in' })
  ]} />
)}

// Reordering/layout animation
<li key={item.id} mix={[animateLayout({ ...spring({ duration: 500, bounce: 0.2 }) })]} />
```

**Reference**: [packages/component/docs](https://github.com/remix-run/remix/tree/main/packages/component/docs)

**Related**: `guides/mixins.md`, `lookup/host-elements.md`