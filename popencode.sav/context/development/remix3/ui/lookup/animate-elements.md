<!-- Context: remix3/lookup/animate-elements | Priority: medium | Version: 1.0 | Updated: 2026-04-16 -->

# Lookup: Animating Elements

**Core Concept**: Use built-in animation mixins (`animateEntrance`, `animateExit`, `animateLayout`, `spring`) on keyed elements.

## Key Points

- `animateEntrance({ opacity: 0, transform: '...' })` - element appears
- `animateExit({ opacity: 0, duration: 120 })` - element disappears
- `animateLayout({ duration: 220 })` - position/size changes
- `spring(...)` - spring-style timing for natural motion

**Rules**:
- Always key conditional/switching elements
- `animateLayout` only on moving/resizing nodes
- One clear transition intent per mixin

## Quick Examples

```tsx
// Enter only
<div mix={[animateEntrance({ opacity: 0, transform: 'translateY(8px)' })]} />

// Toggle visibility
{visible && (
  <div key="panel" mix={[animateEntrance({...}), animateExit({...})]} />
)}

// Reordering
<li key={item.id} mix={[animateLayout({ ...spring() })]} />

// Shared layout swap
<div mix={[css({ display: 'grid', '& > *': { gridArea: '1 / 1' } })]}>
  {state ? <div key="a" mix={[animateEntrance({}), animateExit({})]} /> : ...}
</div>
```

## Reference

- Creating mixins: `lookup/create-mixins.md`
- Full docs: `~/remix/skills/remix-ui/references/animate-elements.md`