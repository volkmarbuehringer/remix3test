<!-- Context: development/remix3/guides/design-system | Priority: high | Version: 1.5 | Updated: 2026-04-02 -->

# Design System

**Purpose**: Unified UI components and design tokens for consistent styling across the app.

## Key Points

- Use CSS variables in components for automatic dark mode support
- Design tokens in `tokens.ts` (colors, spacing, typography, shadows)
- Components: Button (variants: primary/secondary/danger/ghost), Card, Table, Pagination, EmptyState
- Focus-visible styles for accessibility on all interactive elements
- Dark mode: Use `[data-theme='dark']` selector, define CSS vars for both themes
- Theme flash prevention: inline script in `<head>` sets `data-theme` before render

## Minimal Example

```typescript
// Tokens
export const tokens = {
  colors: { primary: '#2196f3', danger: '#dc3545', text: '#333' },
  spacing: { sm: '0.5rem', md: '1rem', lg: '1.5rem' },
}

// CSS Variables (theme.css)
:root { --color-primary: #2196f3; --color-bg: #fff; }
[data-theme='dark'] { --color-primary: #60a5fa; --color-bg: #111827; }

// Button with CSS variables
css({
  background: 'var(--color-primary)',
  '&:hover': { background: 'var(--color-primary-hover)' },
})
```


**Related**: `ui/web/concepts/design-systems.md`, `guides/form-patterns.md`