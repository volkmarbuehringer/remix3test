---
title: 'Remix 3 Theme Extension Pattern — Custom Brand Colors'
tags: [remix3, theme, css, dark-mode, branding, styling]
created: 2026-06-01
status: active
---

## Problem

Adding custom color tokens (e.g., a brand accent palette) to `app/theme.tsx` doesn't work the way you'd expect. The `createTheme` function from `remix/ui/theme` has a fixed contract type (`ThemeVariableNames`) that only accepts specific keys like `text`, `border`, `focus`, `overlay`, and `action` under `colors`. Adding a `brand` key to `lightColors`/`darkColors`:

1. Causes a TypeScript error when accessing `theme.colors.brand.accent` (property doesn't exist on the contract type)
2. Generates no CSS custom properties — `collectThemeVars()` only iterates over keys in the contract, so extra keys are silently ignored
3. At runtime, `theme.colors.brand.accent` evaluates to `var(--rmx-color-brand-accent)` which has no CSS variable declared — resulting in `undefined` in CSS

## Solution

Use a two-part pattern:

### 1. Define brand values as standalone constants in `theme.tsx`

Extract brand colors into standalone constants BEFORE the theme object definitions so they can be referenced by both the theme values and exported for component use:

```tsx
// app/theme.tsx

const BRAND_LIGHT_ACCENT = '#c73d2a'
const BRAND_LIGHT_ACCENT_HOVER = '#a83222'
const BRAND_DARK_ACCENT = '#d64d3a'
const BRAND_DARK_ACCENT_HOVER = '#c73d2a'
```

### 2. Use constants in the runtime theme objects

Reference the constants in both `lightColors` and `darkColors` for documentation/organization:

```tsx
const lightColors = {
  // ... standard keys ...
  brand: {
    accent: BRAND_LIGHT_ACCENT,
    accentHover: BRAND_LIGHT_ACCENT_HOVER,
  },
}
```

### 3. Export raw values for component use

Export a separate `brand` object with the raw hex values so components can import and use them directly:

```tsx
export const brand = {
  light: { accent: BRAND_LIGHT_ACCENT, accentHover: BRAND_LIGHT_ACCENT_HOVER },
  dark: { accent: BRAND_DARK_ACCENT, accentHover: BRAND_DARK_ACCENT_HOVER },
}
```

### 4. Use `'[data-theme="dark"] &'` nesting in `css()` for dark mode

In component styles, use the imported raw values with the `'[data-theme="dark"] &'` selector — this IS supported by remix/ui's `css()` function:

```tsx
import { brand } from '../theme.tsx'

const brandDotCss = css({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: brand.light.accent,
  '[data-theme="dark"] &': {
    backgroundColor: brand.dark.accent,
  },
})
```

### 5. For truly custom CSS variables that need `var()` references

If you need CSS custom properties (e.g., for use with `var()` in many places), define them via a `<style>` tag — the same pattern used for keyframes in `scaffold-home-page.tsx`:

```tsx
function BrandStyles() {
  return () => (
    <style>{`
      :root {
        --brand-accent: ${brand.light.accent};
        --brand-accent-hover: ${brand.light.accentHover};
      }
      [data-theme="dark"] {
        --brand-accent: ${brand.dark.accent};
        --brand-accent-hover: ${brand.dark.accentHover};
      }
    `}</style>
  )
}
```

### 6. To replace the default primary action color

Change `action.primary.background` in `lightColors` and `darkColors` to use the brand constants. This affects all primary buttons, badges, and focus rings across the app:

```tsx
action: {
  primary: {
    background: BRAND_LIGHT_ACCENT,     // was '#2dacf9'
    backgroundHover: BRAND_LIGHT_ACCENT_HOVER,
    foreground: 'rgb(255 255 255 / 0.92)',
    border: BRAND_LIGHT_ACCENT,
  },
}
```

## Why

The Remix 3 theme system is built on a fixed CSS custom property contract. `createTheme()` generates `--rmx-*` variables for every key in `ThemeVariableNames` and applies them under a selector (`:root` or `[data-theme="dark"]`). Extra keys in the values object are stored in `ThemeComponent.values` but never generate CSS variables — they're effectively dead code if accessed via `theme.xxx` (which maps to `var(--rmx-xxx)`).

The `'[data-theme="dark"] &'` selector nesting works in `css()` because the runtime compiles it to `[data-theme="dark"] .generated-class-name { ... }` — a standard CSS descendant selector that respects the attribute on `<html>`.

Using standalone constants with `export` avoids both the type error and the missing CSS variable problem, and keeps the theme.tsx file as the single source of truth for the brand palette.
