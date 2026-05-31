<!-- Context: development/remix3/lookup/theme-contract-variables | Priority: high | Version: 1.0 | Updated: 2026-04-28 -->

# Lookup: Theme Contract CSS Variables

**Purpose**: Canonical `--rmx-*` CSS variable names from the theme contract for raw CSS files. Use `var(--rmx-*)` in CSS; use `theme.*` in `css()` mixins.

> **Note**: `createTheme()` compiles leaf values to `var(--rmx-...)`. The prefix is **singular** `--rmx-color-*`, NOT `--rmx-colors-*`.

---

## Color

```css
--rmx-color-text-primary | secondary | muted
--rmx-color-border-default | strong
--rmx-color-focus-ring
--rmx-color-action-{primary|secondary|danger}-{background|background-hover|background-active|foreground|border}
```

## Surface Levels

```css
--rmx-surface-lvl0  /* Cards, inputs, table body */
--rmx-surface-lvl1  /* Body bg, table header */
--rmx-surface-lvl2  /* Alerts, hover, badges */
--rmx-surface-lvl3  /* Header, footer */
--rmx-surface-lvl4  /* Highest emphasis */
```

## Shadows / Radii

```css
--rmx-shadow-{xs|sm|md|lg|xl}
--rmx-radius-{sm|md|lg|xl|full}
```

## Typography

```css
--rmx-font-family-{sans|mono}
--rmx-font-size-{xxxs|xxs|xs|sm|md|lg|xl|xxl}
--rmx-line-height-{tight|normal|relaxed}
--rmx-font-weight-{normal|medium|semibold|bold}
```

## Spacing

```css
--rmx-space-{none|px|xs|sm|md|lg|xl|xxl}
```

## Code Patterns

```typescript
// css() mixins (type-safe):
import { theme } from 'remix/ui/theme'
let style = css({ color: theme.colors.text.primary })

// Raw CSS:
.book-card { background: var(--rmx-surface-lvl0); }
```

## 📂 Codebase References

**Theme source**: `bookstore/app/ui/theme.tsx` — Light/Dark theme creation
**CSS consumer**: `bookstore/public/app.css` — All variables in use
**Contract source**: `packages/ui/src/lib/theme/contract.ts` — createTheme() contract

**Related**: `concepts/theme-contract.md`, `concepts/theme-switching.md`, `bookstore-demo/concepts/dark-mode-styling.md`
