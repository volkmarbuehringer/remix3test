<!-- Context: development/remix3/ui/guides/dual-theme-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Guide: Dual Light + Dark Theme Pattern

**Core Idea**: Define two themes with `createTheme()` — one default (light) and one dark variant with a CSS selector — and render both in the document so every `--rmx-*` CSS variable is available in both color schemes.

---

## Why Two `createTheme()` Calls

A single `createTheme()` renders CSS variables scoped to `:root`. For dark mode, you need a second set of variables scoped to a selector (typically `[data-theme="dark"]`). Two `createTheme()` calls give you:

- **Typed contracts** for both themes — lint-catching against the same token shape
- **Automatic `--rmx-*` prefixing** — no manual CSS variable naming
- **Scoped selectors** — dark variables only activate under `[data-theme="dark"]`

---

## The Pattern

Create a single file (e.g., `app/theme.tsx`) with two exports:

```tsx
import { createTheme } from 'remix/ui'

// Light theme — default, scoped to :root
export const Theme = createTheme({
  space: { none: '0px', px: '1px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '48px' },
  radius: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  fontFamily: { sans: 'Inter, system-ui, sans-serif', mono: '"Fira Code", monospace' },
  fontSize: { xxxs: '11px', xxs: '12px', xs: '13px', sm: '14px', md: '16px', lg: '18px', xl: '20px', xxl: '24px' },
  colors: {
    text: { primary: '#111827', secondary: '#374151', muted: '#6b7280' },
    border: { subtle: '#e5e7eb', default: '#d1d5db' },
    action: {
      primary: { background: '#2563eb', foreground: '#ffffff' },
      danger: { background: '#dc2626', foreground: '#ffffff' },
    },
    focus: { ring: '#2563eb', outline: '#93c5fd' },
    overlay: { background: 'rgb(0 0 0 / 0.3)' },
  },
  surface: { lvl0: '#ffffff', lvl1: '#f7fbff', lvl2: '#f0f4f8', lvl3: '#e4e9f0', lvl4: '#dee2e6' },
  shadow: {
    xs: '0 1px 2px rgb(0 0 0 / 0.04)',
    sm: '0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
    // ... more shadow levels
  },
})

// Dark theme — scoped to [data-theme="dark"]
export const DarkTheme = createTheme({
  // Same token structure, different values
  colors: {
    text: { primary: '#e5e7eb', secondary: '#9ca3af', muted: '#6b7280' },
    border: { subtle: '#374151', default: '#4b5563' },
    action: {
      primary: { background: '#3b82f6', foreground: '#ffffff' },
      danger: { background: '#ef4444', foreground: '#ffffff' },
    },
    focus: { ring: '#3b82f6', outline: '#60a5fa' },
    overlay: { background: 'rgb(0 0 0 / 0.6)' },
  },
  surface: { lvl0: '#1a1d23', lvl1: '#22262e', lvl2: '#2a2f38', lvl3: '#323842', lvl4: '#363a3e' },
  shadow: {
    xs: '0 1px 2px rgb(0 0 0 / 0.4)',
    sm: '0 1px 3px rgb(0 0 0 / 0.5), 0 1px 2px rgb(0 0 0 / 0.3)',
    // ... deeper shadows for dark
  },
}, { selector: '[data-theme="dark"]', reset: false })
```

---

## Rendering Both Themes

In your document layout, render both theme components:

```tsx
import { Theme, DarkTheme } from '~/theme.tsx'

function Document() {
  return (
    <html lang="en" data-theme={themeCookie === 'dark' ? 'dark' : undefined}>
      <head>
        <Theme />            {/* Emits :root { --rmx-* } CSS vars */}
        <DarkTheme.Style />  {/* Emits [data-theme="dark"] { --rmx-* } CSS vars */}
        {/* ... meta, title, scripts */}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- `<Theme />` renders as `:root { --rmx-space-none: 0px; ... }` — always active
- `<DarkTheme.Style />` renders as `[data-theme="dark"] { --rmx-space-none: 0px; ... }` — only active when `data-theme="dark"` is present on `<html>`

Toggling the `data-theme` attribute on `<html>` switches which set of values apply.

---

## Value Adaptation Guidelines

When adapting values for dark mode, follow these principles:

| Token Category | Light → Dark Strategy |
|----------------|----------------------|
| **Surface** (`lvl0`–`lvl4`) | Invert — lightest becomes darkest. `#ffffff` → `#1a1d23` |
| **Text** | Lighter values on dark backgrounds. `#111827` → `#e5e7eb` |
| **Accent colors** | Brighten for contrast. `#2563eb` → `#3b82f6` |
| **Danger/error** | Brighten. `#dc2626` → `#ef4444` |
| **Shadows** | Darker/deeper on dark. Use `rgb(0 0 0 / 0.4)` → `rgb(0 0 0 / 0.6)` |
| **Borders** | Lighter strokes on dark. `#e5e7eb` → `#374151` |

The `surface` and `shadow` categories are already light/dark independent in the token contract — they are NOT CSS variables tied to `data-theme`. You must provide dark-mode values explicitly in the dark `createTheme()` call.

---

## Cookie + SSR Coordination

The dual-theme pattern works with the SSR theme switching architecture:

1. **SSR**: Read a `theme` cookie, set `data-theme="dark"` on `<html>` if dark
2. **CSS**: `<DarkTheme.Style />` variables activate under `[data-theme="dark"]`
3. **Toggle**: Client-side JS flips `data-theme` attribute + updates cookie + `localStorage`

See `concepts/theme-switching.md` for the full three-layer switching architecture.

---

## ⚠️ Gotchas

- **`reset: false`** is required on the dark theme to avoid resetting `:root` defaults
- **`DarkTheme.Style`** (note `.Style`) is the correct accessor — not `DarkTheme` directly
- The `space` key set is fixed: `{ none, px, xs, sm, md, lg, xl, xxl }` only. See `concepts/theme-contract.md`.
- Action color properties use `.foreground` (NOT `.text`) and `.backgroundHover` (NOT `.hover`) — see `errors/theme-contract-naming-gotchas.md`

---

## 📂 Codebase References

- `demos/bookstore/app/theme.tsx` — Example light + dark theme definition
- `demos/bookstore/app/ui/document.tsx` — `<Theme />` + `<DarkTheme.Style />` rendering

## Related

- `concepts/theme-contract.md` — `createTheme()` API and token shape
- `concepts/theme-switching.md` — Three-layer SSR switching (cookie, flash-prevention, event delegation)
- `errors/theme-contract-naming-gotchas.md` — Common naming pitfalls
- `guides/css-mixins.md` — Using `theme.*` tokens in `css()` blocks
