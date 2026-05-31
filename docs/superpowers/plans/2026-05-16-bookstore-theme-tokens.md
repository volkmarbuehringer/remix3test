# Bookstore Theme Token System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a typed design token system via `createTheme()` from `remix/ui/theme`, centralizing the bookstore's color palette and replacing hardcoded color values across CSS and `css()` mixins.

**Architecture:** A single `app/theme.tsx` defines the full token contract (colors, surfaces, shadows, spacing, typography). The `<Theme />` component renders `--rmx-*` CSS variables on `:root`. The existing `app.css` references these variables via `var(--rmx-*)`. Inline `css()` mixins use `theme.*` tokens. No dark mode, no toggle, no cookies.

**Tech Stack:** Remix 3, `remix/ui/theme` (createTheme, theme), `remix/ui` (css)

---

### Task 1: Create app/theme.tsx

**Files:**
- Create: `app/theme.tsx`

- [ ] **Step 1: Write app/theme.tsx**

```tsx
import { createTheme } from 'remix/ui/theme'

const SURFACE = {
  lvl0: '#f5f5f5',
  lvl1: '#ffffff',
  lvl2: '#f8f9fa',
  lvl3: '#ecf0f1',
  lvl4: '#e0e0e0',
}

const COLORS = {
  text: {
    primary: '#333333',
    secondary: '#666666',
    muted: '#7f8c8d',
    link: '#3498db',
  },
  border: {
    subtle: '#ecf0f1',
    default: '#dddddd',
    strong: '#cccccc',
  },
  focus: { ring: '#3498db' },
  overlay: { scrim: 'rgba(0, 0, 0, 0.28)' },
  action: {
    primary: {
      background: '#3498db',
      backgroundHover: '#2980b9',
      backgroundActive: '#2471a3',
      foreground: '#ffffff',
      border: '#3498db',
    },
    secondary: {
      background: '#95a5a6',
      backgroundHover: '#7f8c8d',
      backgroundActive: '#6c7a7a',
      foreground: '#ffffff',
      border: '#95a5a6',
    },
    danger: {
      background: '#e74c3c',
      backgroundHover: '#c0392b',
      backgroundActive: '#a93226',
      foreground: '#ffffff',
      border: '#e74c3c',
    },
  },
}

const BASE_THEME_VALUES = {
  space: {
    none: '0px',
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontFamily: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {
    xxxs: '10px',
    xxs: '11px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
    meta: '0.06em',
    wide: '0.08em',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  control: {
    height: {
      sm: '28px',
      md: '32px',
      lg: '36px',
    },
  },
}

const SHADOW = {
  xs: '0 1px 2px rgb(0 0 0 / 0.04)',
  sm: '0 1px 3px rgb(0 0 0 / 0.08)',
  md: '0 2px 4px rgb(0 0 0 / 0.1)',
  lg: '0 4px 8px rgb(0 0 0 / 0.15)',
  xl: '0 8px 16px rgb(0 0 0 / 0.2)',
}

export const Theme = createTheme({
  ...BASE_THEME_VALUES,
  surface: SURFACE,
  shadow: SHADOW,
  colors: COLORS,
})
```

- [ ] **Step 2: Verify with typecheck**

Run: `pnpm run typecheck`
Expected: No errors (the new file should compile cleanly since all `createTheme` values match the `ThemeValues` contract type).

---

### Task 2: Update document.tsx to render Theme

**Files:**
- Modify: `app/ui/document.tsx`

- [ ] **Step 1: Add Theme import and rendering**

Change from:

```tsx
import type { RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'

export interface DocumentProps {
  title?: string
  children?: RemixNode
}

export function Document() {
  return ({ title = 'Bookstore', children }: DocumentProps) => {
    let { scriptSrc, scriptPreloads, stylesheetHref } = getAssetEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" async src={scriptSrc} />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
```

To:

```tsx
import type { RemixNode } from 'remix/ui'

import { getAssetEntry } from '../middleware/asset-entry.ts'
import { Theme } from '../theme.tsx'

export interface DocumentProps {
  title?: string
  children?: RemixNode
}

export function Document() {
  return ({ title = 'Bookstore', children }: DocumentProps) => {
    let { scriptSrc, scriptPreloads, stylesheetHref } = getAssetEntry()

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <Theme />
          <link rel="stylesheet" href={stylesheetHref} />
          {scriptPreloads.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}
          <script type="module" async src={scriptSrc} />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
```

- [ ] **Step 2: Verify with typecheck**

Run: `pnpm run typecheck`
Expected: No errors

---

### Task 3: Migrate app.css to use theme variables

**Files:**
- Modify: `app/assets/app.css`

This task replaces all hardcoded color values in `app.css` with `var(--rmx-*)` references. Structural CSS (layout, grid, reset) stays unchanged.

**Changes:**

- [ ] **Step 1: Replace body, header, nav, footer, and main colors**

Apply these edits:

| Location | Find | Replace With |
|----------|------|-------------|
| `body color` | `#333` | `var(--rmx-color-text-primary)` |
| `body background` | `#f5f5f5` | `var(--rmx-surface-lvl0)` |
| `header box-shadow` | `rgba(0, 0, 0, 0.1)` | `rgb(0 0 0 / 0.1)` (keep, no var) |
| `main min-height` | `calc(100vh - 200px)` | keep unchanged |
| `footer margin-top` | `4rem` | keep unchanged |

- [ ] **Step 2: Replace .card colors**

| Find | Replace With |
|------|-------------|
| `.card { background: white;` | `.card { background: var(--rmx-surface-lvl1);` |
| `.card { box-shadow: 0 2px 4px rgba(0,0,0,0.1);` | keep unchanged (shadow values stay) |

- [ ] **Step 3: Replace .btn colors**

| Find | Replace With |
|------|-------------|
| `.btn { background: #3498db;` | `.btn { background: var(--rmx-color-action-primary-background);` |
| `.btn { color: white;` | `.btn { color: var(--rmx-color-action-primary-foreground);` |
| `.btn:hover { background: #2980b9;` | `.btn:hover { background: var(--rmx-color-action-primary-background-hover);` |
| `.btn-secondary { background: #95a5a6;` | `.btn-secondary { background: var(--rmx-color-action-secondary-background);` |
| `.btn-secondary:hover { background: #7f8c8d;` | `.btn-secondary:hover { background: var(--rmx-color-action-secondary-background-hover);` |
| `.btn-danger { background: #e74c3c;` | `.btn-danger { background: var(--rmx-color-action-danger-background);` |
| `.btn-danger:hover { background: #c0392b;` | `.btn-danger:hover { background: var(--rmx-color-action-danger-background-hover);` |

- [ ] **Step 4: Replace .form-group input/textarea/select colors**

| Find | Replace With |
|------|-------------|
| `border: 1px solid #ddd;` | `border: 1px solid var(--rmx-color-border-default);` |

Note: There is one `.form-group input` rule and one `.form-group textarea` rule. Both have `border: 1px solid #ddd`. They may need separate edits or a `replaceAll`.

- [ ] **Step 5: Replace table colors**

| Find | Replace With |
|------|-------------|
| `table { background: white;` | `table { background: var(--rmx-surface-lvl1);` |
| `th { background: #f8f9fa;` | `th { background: var(--rmx-surface-lvl2);` |
| `th, td { border-bottom: 1px solid #ddd;` | `th, td { border-bottom: 1px solid var(--rmx-color-border-default);` |

- [ ] **Step 6: Replace .book-card colors**

| Find | Replace With |
|------|-------------|
| `.book-card { background: white;` | `.book-card { background: var(--rmx-surface-lvl1);` |
| `.book-card img { background: #ecf0f1;` | `.book-card img { background: var(--rmx-surface-lvl3);` |
| `.book-card .author { color: #7f8c8d;` | `.book-card .author { color: var(--rmx-color-text-muted);` |
| `.book-card .price { color: #27ae60;` | keep unchanged (element-specific) |

- [ ] **Step 7: Replace alert and badge colors**

These are element-specific and don't have matching contract tokens. **Keep all values unchanged:**
- `.alert-success` (background, border, color)
- `.alert-error` (background, border, color)
- `.badge-success`, `.badge-warning`, `.badge-info`

- [ ] **Step 8: Verify typecheck still passes**

Run: `pnpm run typecheck`
Expected: No errors (CSS changes don't affect typecheck)

---

### Task 4: Update inline css() mixins to use theme tokens

**Files:**
- Modify: `app/assets/cart-items.tsx`
- Modify: `app/assets/image-carousel.tsx`
- Modify: `app/actions/admin/books/form.tsx`
- Modify: `app/actions/books/show-page.tsx`
- Modify: `app/actions/auth/login/page.tsx`
- Modify: `app/actions/auth/forgot-password/page.tsx`

- [ ] **Step 1: Update app/assets/cart-items.tsx**

Add `theme` import (alongside existing `css` import):
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change line with `color: '#666'`:
```tsx
// Before:
<p mix={css({ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' })}>
// After:
<p mix={css({ marginBottom: '1rem', fontSize: '0.9rem', color: theme.colors.text.secondary })}>
```

- [ ] **Step 2: Update app/assets/image-carousel.tsx**

Add `theme` import:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change:
```tsx
// Before:
backgroundColor: '#f5f5f5',
// After:
backgroundColor: theme.surface.lvl0,
```

- [ ] **Step 3: Update app/actions/admin/books/form.tsx**

Add `theme` import:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change both `color: '#666'` instances:
```tsx
// Before (line ~102):
<p mix={css({ fontSize: '0.875rem', color: '#666' })}>Current cover image</p>
// After:
<p mix={css({ fontSize: '0.875rem', color: theme.colors.text.secondary })}>Current cover image</p>

// Before (line ~106):
<small mix={css({ color: '#666' })}>
// After:
<small mix={css({ color: theme.colors.text.secondary })}>
```

- [ ] **Step 4: Update app/actions/books/show-page.tsx**

Add `theme` import:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change:
```tsx
// Before (around line 54):
background: '#f8f9fa',
// After:
background: theme.surface.lvl2,
```

Leave the `color: '#e74c3c'` (out-of-stock warning) unchanged — it's element-specific.

- [ ] **Step 5: Update app/actions/auth/login/page.tsx**

Add `theme` import:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change:
```tsx
// Before (around line 57):
background: '#f8f9fa',
// After:
background: theme.surface.lvl2,
```

- [ ] **Step 6: Update app/actions/auth/forgot-password/page.tsx**

Add `theme` import:
```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
```

Change:
```tsx
// Before (around line 44):
background: '#f8f9fa',
// After:
background: theme.surface.lvl2,
```

- [ ] **Step 7: Verify typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 8: Run tests**

Run: `pnpm test`
Expected: All tests pass

---

### Task 5: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm run typecheck`
Expected: Clean exit, no errors

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Start dev server and smoke test**

Run: `pnpm run dev`
Expected: Server starts, homepage renders with same visual appearance as before (colors unchanged, just now sourced from theme tokens via `var(--rmx-*)`)

Navigate to a few pages (books, book detail, login, admin) to verify no visual regressions.
