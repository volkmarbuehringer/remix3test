# Concept: Theme Contract

**Core Idea**: Remix UI's `createTheme()` defines a typed, nested token contract where leaf values compile to `var(--rmx-...)` CSS custom properties. The returned component renders a `<style>` tag with the variables.

**Key Points**:
- Deeply typed — define token structure once (space, radius, colors, fontSize, shadow, zIndex, surface, etc.)
- `createTheme()` returns a component; render `<Theme />` in `<head>` to emit CSS vars
- First-party components (button, etc.) expose styling entrypoints like `button.*Style` that consume the theme
- Theme values resolve to `var(--rmx-...)` references when used in component styles
- Import from `remix/ui`

> **⚠️ Action Color Naming**: The contract uses `.foreground` (NOT `.text`) and `.backgroundHover` (NOT `.hover`) for action/danger/secondary color variants. This is a common gotcha. See `../errors/theme-contract-naming-gotchas.md`.

> **⚠️ Space Key Set is Fixed (added 2026-05-06)**: The `space` property in `createTheme()` accepts only these keys: `{ none, px, xs, sm, md, lg, xl, xxl }`. Attempting to add custom keys (e.g., `nm` for `0.75rem`) causes TypeScript error `TS2353: Object literal may only specify known properties, and 'nm' does not exist in type`. The type is a union of literal strings, not an index signature.

**Quick Example**:
```tsx
import { createTheme } from 'remix/ui'

let Theme = createTheme({
  space: { none: '0px', sm: '4px', md: '8px', lg: '12px' },
  colors: {
    text: { primary: '#111827', secondary: '#374151' },
    border: { subtle: '#e5e7eb', default: '#d1d5db' },
  },
})

// In Layout <head>:
// <Theme /> → <style>:root { --rmx-space-none: 0px; ... }</style>
```

**Consumption in component styles**:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui'

let card = css({
  backgroundColor: theme.surface.lvl0,   // var(--rmx-surface-lvl0)
  color: theme.colors.text.primary,       // var(--rmx-colors-text-primary)
  paddingInline: theme.space.md,          // var(--rmx-space-md)
})
```

**Reference**: `packages/ui/README.md`
