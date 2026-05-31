<!-- Context: project-intelligence/bookstore/concepts/theme-setup | Priority: high | Version: 1.0 | Updated: 2026-05-16 -->

# Concept: Theme Token System

**Core Idea**: Use `createTheme()` from `remix/ui/theme` to define a single light-mode theme with a typed token contract covering colors, surfaces, shadows, and base design values. Tokens emit as `--rmx-*` CSS variables on `:root` and are consumed via `var(--rmx-*)` in CSS files or `theme.*` in `css()` mixins.

---

## Structure

Single theme (no dark mode), defined in `app/theme.tsx`:

| Category | Section | Token Examples |
|----------|---------|---------------|
| **Base** | `BASE_THEME_VALUES` | `space`, `radius`, `fontFamily`, `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight`, `control` |
| **Surface** | `SURFACE` | `lvl0` (page bg `#f5f5f5`) → `lvl4` (subtle divider `#e0e0e0`) |
| **Shadow** | `SHADOW` | `xs`–`xl` (5 depth levels) |
| **Colors** | `COLORS` | `text.*`, `border.*`, `focus.*`, `overlay.*`, `action.*` |

---

## BASE_THEME_VALUES Pattern

Shared tokens extracted into a constant (identical values pattern, ready for future dark mode):

```tsx
const BASE_THEME_VALUES = {
  space: { none: '0px', px: '1px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
  radius: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  fontFamily: { sans: 'system-ui, ...', mono: 'ui-monospace, ...' },
  fontSize: { xxxs: '10px', xxs: '11px', xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '20px', xxl: '28px' },
  lineHeight: { tight: '1.25', normal: '1.45', relaxed: '1.65' },
  fontWeight: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  control: { height: { sm: '28px', md: '32px', lg: '36px' } },
}
```

Note: `fontFamily.sans` uses system-ui stack — NOT JetBrains Mono (which is specific to newapp).

---

## Color Palette Mapping

| Token | Value | Usage |
|-------|-------|-------|
| `text.primary` | `#333333` | Body text |
| `text.secondary` | `#666666` | Labels, descriptions |
| `text.muted` | `#7f8c8d` | Author names, meta |
| `text.link` | `#3498db` | Link color |
| `action.primary.*` | `#3498db` / `#2980b9` / `#2471a3` | Primary buttons |
| `action.secondary.*` | `#95a5a6` / `#7f8c8d` / `#6c7a7a` | Secondary buttons |
| `action.danger.*` | `#e74c3c` / `#c0392b` / `#a93226` | Danger buttons |
| `border.default` | `#dddddd` | Form inputs, table borders |
| `border.subtle` | `#ecf0f1` | Subtle dividers |

---

## Tokenized vs Hardcoded

**Tokenized** in `app/assets/app.css` via `var(--rmx-*)`: body colors, card backgrounds, all button variants, form borders, table backgrounds/borders, book card placeholders, author text.

**Tokenized** in action files via `theme.*` in `css()`: secondary text (`theme.colors.text.secondary`), surface levels (`theme.surface.lvl0`, `theme.surface.lvl2`).

**Stays hardcoded**: header/footer brands (`#2c3e50`, `#34495e`), price green (`#27ae60`), alert colors, badge colors — these are brand-specific and outside the general color contract.

---

## Rendering

In `app/ui/document.tsx`, `<Theme />` in `<head>` emits `--rmx-*` CSS variables on `:root`.

---

## 📂 Codebase References

- **Theme definition**: `app/theme.tsx` — Full `createTheme()` call
- **Document rendering**: `app/ui/document.tsx` — `<Theme />` in `<head>`
- **CSS consumption**: `app/assets/app.css` — `var(--rmx-*)` references
- **Mixin consumption**: `app/actions/cart-items.tsx`, `app/actions/admin/books/form.tsx`, `app/assets/image-carousel.tsx`, `app/actions/books/show-page.tsx`, `app/actions/auth/login/page.tsx`, `app/actions/auth/forgot-password/page.tsx` — `theme.*` in `css()`

## Related

- [Theme contract (remix3)](../../development/remix3/ui/concepts/theme-contract.md) — `createTheme()` API docs
- [Theme setup (newapp)](../newapp/concepts/theme-setup.md) — Similar pattern with dark mode
- [Dual theme pattern (remix3)](../../development/remix3/ui/guides/dual-theme-pattern.md) — General light+dark (not used here)
- [CSS mixins guide (remix3)](../../development/remix3/ui/guides/css-mixins.md) — `theme.*` in `css()` calls
- [UI styling guide](../guides/ui-styling.md) — How tokens integrate with CSS architecture
