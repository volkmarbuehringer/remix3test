<!-- Context: development/remix3/concepts/design-system | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Design System

Foundation for consistent UI using CSS custom properties as design tokens.

## Concept

Design tokens are named variables that store design decisions (colors, spacing, typography). They enable consistency and theming.

## Architecture

```
Design Tokens (CSS Variables)
    ↓
Component Styles (use var())
    ↓
UI Components (applied)
```

## Key Principles

- **Named values** - `--color-primary` not `#6366f1`
- **Scale-based** - `--space-1` through `--space-12`
- **Semantic colors** - `--color-success` not `--color-green`
- **Composable** - Can combine in calculations

## Color Scale Example

```css
--color-slate-900: #0f172a; /* darkest */
--color-slate-700: #334155;
--color-slate-500: #64748b;
--color-slate-300: #cbd5e1;
--color-slate-100: #f1f5f9;
--color-slate-50: #f8fafc; /* lightest */
```

## Benefits

- Single source of truth
- Easy theming (dark mode)
- Consistent spacing/typography
- Faster development

## Reference

- `lookup/css-variables.md` - Full variable list
- `examples/skeleton-loaders.md` - Loading states
- CSS implementation in your project's stylesheet
