---
name: remix3-theme-css-variable-prefix
description: "Remix 3 theme variables use --rmx- prefix; bare var(--name, fallback) silently breaks dark mode"
origin: auto-extracted
---

# Remix 3 Theme CSS Variable Prefix

**Extracted:** 2026-07-12
**Context:** Fixing invisible button text in dark mode in a Remix 3 clientEntry. The slot buttons used `var(--surface-lvl1, #f5f5f5)` which never resolved because the theme defines `--rmx-surface-lvl1`.

## Problem

The Remix 3 theme system (defined in `app/ui/theme/contract.ts`) uses **`--rmx-` prefixed** CSS variable names:

```
--rmx-surface-lvl0
--rmx-surface-lvl1
--rmx-color-text-primary
--rmx-color-text-secondary
--rmx-color-border-default
```

Inline styles using **bare variable names** with fallbacks silently resolve to the fallback in **all themes**:

```js
// BAD — never resolves in dark mode, fallback is always light-mode color
background: var(--surface-lvl1, #f5f5f5);
color: var(--text-primary, #333);
border: 1px solid var(--border-color, #ddd);
```

In dark mode (`data-theme="dark"` on `<html>`), the body inherits light text (`#dee2e6` for `--rmx-color-text-primary`). But bare variables without the `--rmx-` prefix never resolve — the light fallback kicks in, producing:

- **Light gray text on light gray background** (invisible)
- **Dark text on dark background** (when `var(--text-primary, #333)` overrides inherited light text)

This can affect any element rendered via `clientEntry` (non-React DOM code) that uses inline styles with CSS variable references.

## Solution

Always use the **full `--rmx-*` variable name** in inline styles. Remove the fallback values — the variables are always defined by the theme injection.

```js
// GOOD — resolves correctly in both light and dark themes
background: var(--rmx-surface-lvl1);
color: var(--rmx-color-text-primary);
border: 1px solid var(--rmx-color-border-default);
```

### Reference: Common theme variables

| Bare name (broken) | Correct `--rmx-*` variable |
|---|---|
| `var(--surface-lvl0, #fff)` | `var(--rmx-surface-lvl0)` |
| `var(--surface-lvl1, #f5f5f5)` | `var(--rmx-surface-lvl1)` |
| `var(--text-primary, #333)` | `var(--rmx-color-text-primary)` |
| `var(--text-secondary, #666)` | `var(--rmx-color-text-secondary)` |
| `var(--border-color, #ddd)` | `var(--rmx-color-border-default)` |

### Light values (for reference)

| Variable | Light | Dark |
|---|---|---|
| `--rmx-surface-lvl0` | `#f7fbff` | `#363a3e` |
| `--rmx-surface-lvl1` | `#f0f4f7` | `#313539` |
| `--rmx-color-text-primary` | `#313539` | `#dee2e6` |
| `--rmx-color-text-secondary` | `#5a5e62` | `#a0a4a8` |
| `--rmx-color-border-default` | `#d0d4d8` | `#3d4145` |

## When to Use

- Writing inline styles in `clientEntry` (client-side JavaScript, no React)
- Rendering DOM elements with CSS variable references in a Remix 3 app
- Debugging invisible text or low-contrast UI in dark mode
- Adding new UI components that need to be theme-aware
