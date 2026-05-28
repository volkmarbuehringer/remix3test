<!-- Context: project-intelligence/newapp/concepts/theme-setup | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Concept: Custom Theme Setup

**Core Idea**: Use `createTheme()` from `remix/ui/theme` to define light + dark themes that preserve the starter app's visual identity (JetBrains Mono, gray palette, `#2dacf9` accent blue) while adopting the standard token contract.

---

## Structure

A single `app/theme.tsx` file uses `createTheme()` to define light + dark themes, providing:
- A typed token contract (`space`, `radius`, `fontFamily`, `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight`, `control`, `surface`, `shadow`, `colors`)
- Light/dark switching via the `selector` option (`[data-theme="dark"]`)
- CSS custom properties (`--rmx-*`) consumed by `theme.*` tokens in `css()` blocks

## BASE_THEME_VALUES Pattern

Shared token groups (`space`, `radius`, `fontFamily`, etc.) are identical between light and dark. Extract into a `BASE_THEME_VALUES` constant, then spread into each theme:

```tsx
const BASE_THEME_VALUES = {
  space: { none: '0px', px: '1px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
  radius: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  fontFamily: { sans: "'JetBrains Mono', ...", mono: 'ui-monospace, ...' },
  fontSize: { xxxs: '10px', xxs: '11px', xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '20px', xxl: '28px' },
  lineHeight: { tight: '1.25', normal: '1.45', relaxed: '1.65' },
  letterSpacing: { tight: '-0.03em', normal: '0', meta: '0.06em', wide: '0.08em' },
  fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  control: { height: { sm: '28px', md: '32px', lg: '36px' } },
}

export const Theme = createTheme({ ...BASE_THEME_VALUES, surface: lightSurface, shadow: lightShadow, colors: lightColors })

export const DarkTheme = createTheme(
  { ...BASE_THEME_VALUES, surface: darkSurface, shadow: darkShadow, colors: darkColors },
  { selector: '[data-theme="dark"]', reset: false },
)
```

**Key rules:**
- `BASE_THEME_VALUES` contains only tokens **identical** between light and dark
- Theme-specific tokens (`surface`, `shadow`, `colors`) stay per-theme
- Use spread (`...BASE_THEME_VALUES`) — do NOT use inheritance or merging utilities

## Token Categories

| Category      | Example Tokens                        | Shared? |
|---------------|---------------------------------------|---------|
| space         | `none`, `px`, `xs`, `sm`, `md`...     | ✅ Base |
| radius        | `none`, `sm`, `md`, `lg`, `xl`, `full`| ✅ Base |
| fontFamily    | `sans`, `mono`                        | ✅ Base |
| fontSize      | `xxxs`–`xxl` (8 levels)               | ✅ Base |
| lineHeight    | `tight`, `normal`, `relaxed`          | ✅ Base |
| fontWeight    | `normal`, `medium`, `semibold`, `bold`| ✅ Base |
| letterSpacing | `tight`, `normal`, `meta`, `wide`     | ✅ Base |
| control       | `height.sm`, `height.md`, `height.lg` | ✅ Base |
| surface       | `lvl0`–`lvl4` (5 levels)              | ❌ Per-theme |
| shadow        | `xs`–`xl` (5 levels)                  | ❌ Per-theme |
| colors        | `text.*`, `border.*`, `action.*`...   | ❌ Per-theme |

## Dark Mode Differences

Dark theme adapts values per level:
- **Surface**: Light `#dee2e6`→`#f7fbff` → Dark `#1e2226`→`#363a3e` (darker is lvl0)
- **Text**: Light `#313539`→`#94989c` → Dark `#dee2e6`→`#6c7074` (lighter on dark)
- **Accent blue**: Light `#2dacf9` → Dark `#5bc0ff` (brighter for contrast)
- **Shadows**: Dark shadows are deeper (`rgb(0 0 0 / 0.4)` → `rgb(0 0 0 / 0.6)`)
- **Danger red**: Light `#dc2626` → Dark `#ef4444` (brighter for contrast)

## Rendering

In `app/ui/document.tsx`:
```tsx
<Theme />              // Emits :root { --rmx-* } CSS vars
<DarkTheme.Style />    // Emits [data-theme="dark"] { --rmx-* } CSS vars
```

Both rendered server-side. Dark mode activates via `data-theme="dark"` on `<html>` (read from cookie).

## ⚠️ Space Key Set is Fixed

The `space` property accepts only `{ none, px, xs, sm, md, lg, xl, xxl }`. Custom keys cause `TS2353`.

## 📂 Codebase References

- **Theme definition**: `app/theme.tsx` — Light + Dark `createTheme()`
- **Document rendering**: `app/ui/document.tsx` — `<Theme />` + `<DarkTheme.Style />`
- **Theme toggle**: `app/assets/theme-toggle.tsx` — Dark mode clientEntry

## Related

- [Component adoption guide](../guides/component-adoption.md) — Button component replaces custom theme mixins
- [Dual theme pattern (remix3)](../../development/remix3/ui/guides/dual-theme-pattern.md) — General light+dark theme pattern (this is the app-specific instance)
- [SSR theme switching (remix3)](../../development/remix3/ui/concepts/theme-switching.md) — Three-layer switching architecture
- [Theme contract (remix3)](../../development/remix3/ui/concepts/theme-contract.md) — `createTheme()` API docs
