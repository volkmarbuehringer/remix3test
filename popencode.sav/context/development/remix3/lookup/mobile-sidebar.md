# Lookup: Mobile Sidebar

**Core Idea**: Convert fixed sidebar to hamburger menu on mobile.

## Breakpoints

- **Desktop** (≥768px): Sidebar always visible
- **Mobile** (<768px): Hidden, hamburger toggles slide-in

## Pattern

```css
/* Desktop */
.sidebar { width: 250px; position: fixed; }

/* Mobile */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
}
```

## Toggle

```tsx
<button onClick={() => setOpen(!open)}>
  {open ? 'Close' : 'Menu'}
</button>
<div class={`sidebar ${open ? 'open' : ''}`}>
```

**Reference**: `.opencode/context/development/remix3/lookup/mobile-sidebar.md`