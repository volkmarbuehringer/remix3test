<!-- Context: project-intelligence/newapp/guides/namespace-mixins | Priority: high | Version: 1.2 | Updated: 2026-05-11 -->

# Guide: Namespace-Style CSS Mixins

**Core Idea**: Each component module exports a single named object containing all its CSS-only mixins (e.g., `button.base`, `button.primary`, `button.ghost`). Consumers import the namespace and get autocomplete for all variants.

---

## The Pattern

Instead of flat exports:

```tsx
// ❌ Flat — hard to discover variants
export const buttonBase = css({ ... })
export const buttonPrimary = css({ ... })
export const buttonGhost = css({ ... })
```

Use a namespace object:

```tsx
// ✅ Namespace — autocomplete on `button.`
export const button = {
  base: css({ ... }),
  primary: css({ ... }),
  ghost: css({ ... }),
}
```

Consumers import:

```tsx
import { button } from '~/ui/mixins/button.ts'

<button type="button" mix={[button.base, button.primary]}>Create</button>
```

## Why Namespace Objects

| Concern | Flat exports | Namespace |
|---------|-------------|-----------|
| Discoverability | Must know all export names | `button.` shows all variants |
| Autocomplete | None from import | IDE surfaces `.base`, `.primary`, etc. |
| Rename safety | Manual rename of all consumers | Rename once in namespace file |
| Consistency | Each module may use different naming | Uniform `{ base, variant1, variant2 }` |

## File Organization

```
app/ui/mixins/
├── card.ts      → export const card = { base }
├── input.ts     → export const input = { base, focus, error }
└── text.ts      → export const text = { heading, body, muted, label }
```

> **Note**: `button.ts` was previously in this directory but has been removed. Button styling is now handled by the `remix/ui/button` `Button` component (see [component-adoption guide](./component-adoption.md)). The mixins directory now only contains modules for non-component-available styling needs.

Each file:
1. Imports `css` from `remix/ui` and `theme` from `remix/ui/theme`
2. Defines one or more `css()` blocks with theme token references
3. Exports a single namespace object

## Adding a New Mixin Module

1. Create `app/ui/mixins/<name>.ts`
2. Import `{ css }` from `remix/ui` and `{ theme }` from `remix/ui/theme`
3. Define a namespace with a `base` entry plus variants
4. Export `const <name> = { base, variant1, ... }`

```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const badge = {
  base: css({
    display: 'inline-flex',
    padding: `${theme.space.xs} ${theme.space.sm}`,
    borderRadius: theme.radius.full,
    fontSize: theme.fontSize.xxs,
    fontWeight: theme.fontWeight.semibold,
  }),
  success: css({
    background: '#16a34a',
    color: 'white',
  }),
  warning: css({
    background: '#f59e0b',
    color: 'white',
  }),
}
```

## Button Variants — Replaced

Button mixins from `app/ui/mixins/button.ts` have been **removed** in favor of the `remix/ui/button` `Button` component:

| Old Pattern | Replacement |
|-------------|-------------|
| `button.base + button.primary` | `<Button tone="primary">` |
| `button.base + button.secondary` | `<Button tone="secondary">` |
| `button.base + button.ghost` | `<Button tone="ghost">` |
| `button.base + button.danger` | `<Button tone="danger">` |

The `Button` component is SSR-safe (Handle-pattern) and works in `app/ui/layout.tsx`. See the [component adoption guide](./component-adoption.md) for migration details.

## Relationship to createMixin()

These are **CSS-only mixins** — pure style objects created with `css()`. They do NOT use `createMixin()` (which creates lifecycle-managed host element mixins). Use `createMixin()` for behavior (focus, animation, interactivity); use namespace CSS mixins for static styling.

## 📂 Codebase References

- **Card mixins**: `app/ui/mixins/card.ts`
- **Input mixins**: `app/ui/mixins/input.ts`
- **Text mixins**: `app/ui/mixins/text.ts`
- **Consuming pages**: `app/ui/showcase-pages.tsx`, `app/ui/scaffold-home-page.tsx`
- **Button component** (replaces old button mixins): `remix/ui/button`

## Related

- [Component adoption guide](./component-adoption.md) — Migrating from mixins to `remix/ui/*` components
- [Namespace mixins (general pattern)](../../development/remix3/ui/guides/namespace-mixins.md) — General namespace pattern documentation (this is the app-specific instance)
- [CSS mixins with design tokens (remix3)](../../development/remix3/ui/guides/css-mixins.md) — `css()` and `theme.*` token usage
- [Creating mixins with createMixin() (remix3)](../../development/remix3/ui/guides/create-mixins.md) — Lifecycle mixins for behavior
