# Styling

**Core Idea**: `css()` mixin for inline styling with pseudo-selectors and nested rules. Generated as CSS cascade layers under parent layer `rmx`.

**Key Points**:
- `css({ color: 'blue', '&:hover': { color: 'darkblue' } })` — supports pseudo-selectors via `&`
- Use `style` prop for dynamic styles (avoids creating new CSS rules on every update)
- Cascade layers: `rmx-reset` (theme reset) → `rmx` (component styles)
- Order layers with `@layer base, rmx-reset, rmx, app;` for override control
- Supports pseudo-elements (`&::before`), attribute selectors (`&[aria-invalid]`), descendant selectors (`& .icon`), media queries (`@media`)
- Prefer CSS nested selectors over JS state for parent-hover-affects-children patterns

**Minimal Example**:
```tsx
<button mix={[css({
  color: 'white', backgroundColor: 'blue', padding: '12px 24px',
  '&:hover': { backgroundColor: 'darkblue' },
  '&:disabled': { opacity: 0.5 },
})]}>Click</button>
```

**Reference**: `~/remix/packages/ui/docs/styling.md`
