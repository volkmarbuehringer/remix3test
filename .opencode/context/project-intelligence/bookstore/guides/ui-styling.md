<!-- Context: project-intelligence/bookstore/guides | Priority: high | Version: 2.0 | Updated: 2026-05-16 -->

# UI Styling Guide

## CSS Architecture

| Layer | File | Purpose |
|-------|------|---------|
| **Theme tokens** | `app/theme.tsx` | Typed token contract via `createTheme()` |
| **CSS variables** | `<Theme />` in `app/ui/document.tsx` | Emits `--rmx-*` vars on `:root` |
| **Base styles** | `app/assets/app.css` | Component styles using `var(--rmx-*)` |
| **Inline mixins** | Action files | `theme.*` tokens inside `css()` mixins |

## How Tokens Flow

```
createTheme()  →  <Theme />  →  :root { --rmx-* }  →  var(--rmx-*) in app.css
                                                      →  theme.* in css() mixins
```

- **In CSS files**: Reference `var(--rmx-color-text-primary)`, `var(--rmx-surface-lvl1)`, etc.
- **In `css()` mixins**: Use `theme.colors.text.primary`, `theme.surface.lvl1`, etc. (compiles to the `var(--rmx-*)` equivalent)
- **Import path**: `import { theme } from 'remix/ui'` for the JS-side token object

## Layout & Page Structure

```css
body {
  color: var(--rmx-color-text-primary);
  background: var(--rmx-surface-lvl0);
}
.card {
  background: var(--rmx-surface-lvl1);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

## Button Variants

```css
.btn            { background: var(--rmx-color-action-primary-background); }
.btn:hover      { background: var(--rmx-color-action-primary-background-hover); }
.btn-secondary  { background: var(--rmx-color-action-secondary-background); }
.btn-danger     { background: var(--rmx-color-action-danger-background); }
```

## Hover Effects

### Book Cards
```css
.book-card {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.book-card:hover {
  transform: translateY(-6px) scale(1.01);
}
```

### Buttons
```css
.btn {
  transition: background 0.2s ease, transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.btn:hover { box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
.btn:active { transform: scale(0.97); }
.btn:focus-visible { outline: 2px solid #3498db; }
```

## Animations

```css
main > .container {
  animation: fadeInUp 0.4s ease-out;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.grid > *:nth-child(1) { animation-delay: 0ms; }
.grid > *:nth-child(2) { animation-delay: 50ms; }
.grid > *:nth-child(3) { animation-delay: 100ms; }

@media (prefers-reduced-motion: reduce) {
  .book-card, .btn { transition: none; animation: none; }
}
```

## Best Practices

1. **Use `theme.*` in `css()`** — always prefer `theme.colors.text.secondary` over hardcoded `#666`
2. **Use `var(--rmx-*)` in `app.css`** — reference tokens directly for base component styles
3. **Don't mix raw `var()` with theme tokens** — see CSS mixins guide for the gotcha
4. **Keep brand colors hardcoded** — header/footer (`#2c3e50`, `#34495e`), price (`#27ae60`), alerts/badges
5. **Include `:focus-visible`** for keyboard nav
6. **Respect `prefers-reduced-motion`**
7. **Use `cubic-bezier(0.4, 0, 0.2, 1)`** for smooth transitions

## Related

- [Theme setup concept](../concepts/theme-setup.md) — Full token reference and contract boundaries
- [CSS mixins guide (remix3)](../../development/remix3/ui/guides/css-mixins.md) — `theme.*` in `css()` calls
- [Theme contract (remix3)](../../development/remix3/ui/concepts/theme-contract.md) — `createTheme()` API docs
- [Token lookup table](../lookup/quick-reference.md) — Hardcoded→token mapping
