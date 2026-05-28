<!-- Context: ui/web/ui-styling-standards | Priority: high | Version: 3.0 | Updated: 2026-04-06 -->

# Concept: UI Styling Standards

**Core Idea**: Mobile-first responsive design using **plain CSS with design tokens** (CSS variables), with hover/transition effects and accessibility support.

## Project-Specific Approach

Different projects may use different approaches. For the **bookstore project**, see: `/project-intelligence/bookstore/ui-styling.md`

**Key Points**:
- Approach: Plain CSS with CSS custom properties (design tokens)
- Mobile-first responsive at breakpoints 375px, 768px, 1024px
- Colors: Semantic naming via CSS variables (`--color-primary`, `--color-text-muted`)
- Transitions: Smooth hover effects with cubic-bezier timing
- Accessibility: `prefers-reduced-motion` support, visible focus states

**Quick Example**:
```css
/* Design tokens */
:root {
  --color-primary: #3b82f6;
  --spacing-md: 1rem;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Component with hover effect */
.book-card {
  background: white;
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.book-card:hover {
  transform: translateY(-6px);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .book-card {
    transition: none;
  }
}
```

## Best Practices

1. **Use design tokens** - Define colors, spacing, shadows as CSS variables
2. **Group related styles** - Keep all card styles together
3. **Mobile-first** - Default styles target mobile, `@media (min-width)` for larger screens
4. **Accessibility** - Include `:focus-visible` styles, respect `prefers-reduced-motion`
5. **Transitions** - Use `cubic-bezier(0.4, 0, 0.2, 1)` for smooth, natural feel
6. **Dark mode** - Use attribute selector `[data-theme='dark']` with overrides

## Reference

See `/project-intelligence/bookstore/ui-styling.md` for bookstore-specific patterns.
