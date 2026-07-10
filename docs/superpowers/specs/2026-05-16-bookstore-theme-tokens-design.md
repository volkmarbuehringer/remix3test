# Bookstore Theme Token System

**Date**: 2026-05-16
**Status**: Draft

## Problem

The bookstore app uses hardcoded color values (`#333`, `#3498db`, `#f5f5f5`, etc.) scattered across `app/assets/app.css` (238 lines) and inline `css()` mixins across ~25 component files. This makes visual consistency hard to maintain and prevents future dark mode or theme switching.

## Solution

Introduce a typed design token system using `createTheme()` from `remix/ui/theme` — the same approach used in the `newapp` project. A single `app/theme.tsx` file defines the complete token contract, emitting `--rmx-*` CSS custom properties consumed by both `app.css` and `css()` mixins.

No dark mode. No toggle. No theme cookie. Just the infrastructure for a consistent, centralized color palette.

## Files Changed

| File                                        | Action  | Description                                  |
| ------------------------------------------- | ------- | -------------------------------------------- |
| `app/theme.tsx`                             | **NEW** | `createTheme()` with bookstore color palette |
| `app/ui/document.tsx`                       | EDIT    | Render `<Theme />` in `<head>`               |
| `app/assets/app.css`                        | EDIT    | Replace color values with `var(--rmx-*)`     |
| `app/assets/cart-items.tsx`                 | EDIT    | `#666` → `theme.colors.text.secondary`       |
| `app/assets/image-carousel.tsx`             | EDIT    | `#f5f5f5` → `theme.surface.lvl0`             |
| `app/actions/admin/books/form.tsx`          | EDIT    | `#666` → `theme.colors.text.secondary`       |
| `app/actions/books/show-page.tsx`           | EDIT    | `#f8f9fa` → `theme.surface.lvl2`             |
| `app/actions/auth/login/page.tsx`           | EDIT    | `#f8f9fa` → `theme.surface.lvl2`             |
| `app/actions/auth/forgot-password/page.tsx` | EDIT    | `#f8f9fa` → `theme.surface.lvl2`             |

## Theme Contract: app/theme.tsx

### Shared base tokens (identical to newapp, with bookstore's font stack)

```
space     → { none, px, xs, sm, md, lg, xl, xxl }
radius    → { none, sm, md, lg, xl, full }
fontFamily → sans: system-ui, -apple-system, sans-serif
fontSize  → { xxxs: 10px … xxl: 28px }
lineHeight → { tight: 1.25, normal: 1.45, relaxed: 1.65 }
letterSpacing → { tight, normal, meta, wide }
fontWeight → { normal, medium, semibold, bold }
control   → { height: { sm: 28px, md: 32px, lg: 36px } }
```

### Bookstore-specific color tokens

| Token                                      | Value                         | Used By                                    |
| ------------------------------------------ | ----------------------------- | ------------------------------------------ |
| `colors.text.primary`                      | `#333333`                     | body text                                  |
| `colors.text.secondary`                    | `#666666`                     | muted labels, captions                     |
| `colors.text.muted`                        | `#7f8c8d`                     | book author, secondary info                |
| `colors.text.link`                         | `#3498db`                     | links                                      |
| `colors.border.subtle`                     | `#ecf0f1`                     | image placeholders, subtle dividers        |
| `colors.border.default`                    | `#dddddd`                     | card borders, input borders, table borders |
| `colors.border.strong`                     | `#cccccc`                     | —                                          |
| `colors.focus.ring`                        | `#3498db`                     | keyboard focus outlines                    |
| `colors.overlay.scrim`                     | `rgba(0,0,0,0.28)`            | —                                          |
| `colors.action.primary.background`         | `#3498db`                     | `.btn` primary                             |
| `colors.action.primary.backgroundHover`    | `#2980b9`                     | `.btn:hover`                               |
| `colors.action.primary.backgroundActive`   | `#2471a3`                     | —                                          |
| `colors.action.primary.foreground`         | `#ffffff`                     | button text                                |
| `colors.action.primary.border`             | `#3498db`                     | —                                          |
| `colors.action.secondary.background`       | `#95a5a6`                     | `.btn-secondary`                           |
| `colors.action.secondary.backgroundHover`  | `#7f8c8d`                     | `.btn-secondary:hover`                     |
| `colors.action.secondary.backgroundActive` | `#6c7a7a`                     | —                                          |
| `colors.action.secondary.foreground`       | `#ffffff`                     | secondary button text                      |
| `colors.action.secondary.border`           | `#95a5a6`                     | —                                          |
| `colors.action.danger.background`          | `#e74c3c`                     | `.btn-danger`                              |
| `colors.action.danger.backgroundHover`     | `#c0392b`                     | `.btn-danger:hover`                        |
| `colors.action.danger.backgroundActive`    | `#a93226`                     | —                                          |
| `colors.action.danger.foreground`          | `#ffffff`                     | danger button text                         |
| `colors.action.danger.border`              | `#e74c3c`                     | —                                          |
| `surface.lvl0`                             | `#f5f5f5`                     | page background                            |
| `surface.lvl1`                             | `#ffffff`                     | cards, tables, content containers          |
| `surface.lvl2`                             | `#f8f9fa`                     | table header, info backgrounds             |
| `surface.lvl3`                             | `#ecf0f1`                     | image placeholders                         |
| `surface.lvl4`                             | `#e0e0e0`                     | —                                          |
| `shadow.xs`                                | `0 1px 2px rgb(0 0 0 / 0.04)` | —                                          |
| `shadow.sm`                                | `0 1px 3px rgb(0 0 0 / 0.08)` | —                                          |
| `shadow.md`                                | `0 2px 4px rgb(0 0 0 / 0.1)`  | cards, buttons                             |
| `shadow.lg`                                | `0 4px 8px rgb(0 0 0 / 0.15)` | —                                          |
| `shadow.xl`                                | `0 8px 16px rgb(0 0 0 / 0.2)` | —                                          |

### Colors that stay hardcoded (element-specific, not reusable tokens)

| Element                      | Value                             | Reason                                                      |
| ---------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Header background            | `#2c3e50`                         | Brand color, single element                                 |
| Footer background            | `#34495e`                         | Brand color, single element                                 |
| Price text                   | `#27ae60`                         | Semantic (green = money), not a reusable surface/text token |
| Alert success bg/border/text | `#d4edda` / `#c3e6cb` / `#155724` | Component-scoped, no contract match                         |
| Alert error bg/border/text   | `#f8d7da` / `#f5c6cb` / `#721c24` | Component-scoped, no contract match                         |
| Badge colors                 | greens/yellows/blues              | Component-scoped, no contract match                         |
| Out-of-stock red             | `#e74c3c`                         | Same value as danger but semantic meaning                   |

## Document Rendering: app/ui/document.tsx

Add 3 lines: import `Theme` from `../theme.tsx`, render `<Theme />` in `<head>`. No data-theme, no cookies, no flash prevention.

```tsx
import { Theme } from '../theme.tsx'
// ...
;<head>
  <Theme /> {/* emits <style>:root { --rmx-* } */}
  // ...
</head>
```

## CSS Migration: app/assets/app.css

Replace color values with `var(--rmx-*)` references. Structure/layout stays untouched.

**Examples:**

```css
/* Before */ /* After */
body {
  body {
    color: #333;
    color: var(--rmx-color-text-primary);
    background: #f5f5f5;
    background: var(--rmx-surface-lvl0);
  }
}

.btn {
  .btn {
    background: #3498db;
    background: var(--rmx-color-action-primary-background);
  }
}
.btn:hover {
  .btn:hover {
    background: #2980b9;
    background: var(--rmx-color-action-primary-background-hover);
  }
}
```

Full mapping documented inline above.

## Inline css() Mixins

Replace hardcoded color values with `theme.*` token references:

```tsx
// Before
<p mix={css({ color: '#666' })}>

// After
<p mix={css({ color: theme.colors.text.secondary })}>
```

Affected files: `cart-items.tsx`, `admin/books/form.tsx` (×2), `books/show-page.tsx`, `auth/login/page.tsx`, `auth/forgot-password/page.tsx`, `image-carousel.tsx`

## What This Unlocks

- **Single source of truth** for all reusable colors
- **Type-safe token access** — `theme.colors.text.primary` is lintable, autocompletable
- **Dark mode foundation** — when/if wanted, just add a DarkTheme with `[data-theme="dark"]`
- **Zero behavioral changes** — the site looks identical, just the color values are centralized
