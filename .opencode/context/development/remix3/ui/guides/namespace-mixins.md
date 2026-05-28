<!-- Context: development/remix3/ui/guides/namespace-mixins | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Guide: Namespace-Style CSS Mixins

**Core Idea**: Export CSS-only mixins as a single named object per module (e.g., `export const button = { base, primary, ghost }`) so consumers get IDE autocomplete for all variants, rename safety, and a consistent discovery pattern.

---

## The Pattern

Instead of flat exports that force consumers to guess variant names:

```tsx
// ❌ Flat exports — hard to discover variants, no autocomplete
export const buttonBase = css({ ... })
export const buttonPrimary = css({ ... })
export const buttonGhost = css({ ... })
```

Use a namespace object:

```tsx
// ✅ Namespace — `button.` surfaces all variants in autocomplete
export const button = {
  base: css({ ... }),
  primary: css({ ... }),
  ghost: css({ ... }),
  danger: css({ ... }),
}
```

Consumers import the namespace:

```tsx
import { button } from '~/ui/mixins/button.ts'

<button type="button" mix={[button.base, button.primary]}>Submit</button>
```

---

## Benefits vs. Flat Exports

| Concern | Flat exports | Namespace object |
|---------|-------------|------------------|
| **Discoverability** | Must know every export name | `button.` shows all variants in autocomplete |
| **Autocomplete** | None from import | IDE surfaces `.base`, `.primary`, `.ghost`, `.danger` |
| **Rename safety** | Manual rename across all consumers | Rename once in the namespace file |
| **Consistent shape** | Each module may use different naming patterns | Uniform `{ base, variant1, variant2 ... }` |
| **Import ergonomics** | May need `import * as` to bundle | Named import, single destructure |

---

## Module Structure

Each mixin module follows a consistent pattern:

```
ui/mixins/
├── button.ts    → export const button = { base, primary, ghost, danger }
├── card.ts      → export const card = { base, elevated, inset }
├── input.ts     → export const input = { base, focus, error }
└── text.ts      → export const text = { heading, body, muted, label }
```

Every file:

1. Imports `{ css }` from `remix/ui` and `{ theme }` from `remix/ui/theme`
2. Defines one or more `css()` blocks referencing theme tokens
3. Exports a single namespace object with a `base` entry plus variants

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

---

## Composition

Compose multiple mixins via the `mix` prop array:

```tsx
// Base + variant for style combinations
<button mix={[button.base, button.primary]}>Save</button>
<button mix={[button.base, button.danger]}>Delete</button>

// Override just what you need
<button mix={[button.base, button.ghost, css({ fontWeight: 'bold' })]}>Cancel</button>
```

---

## Relationship to `createMixin()`

| Approach | When to use |
|----------|------------|
| **Namespace CSS mixins** (this guide) | Static styling only — pure style objects created with `css()`. No lifecycle, no behavior. |
| **`createMixin()`** | Lifecycle-managed host-element mixins — focus management, animation, event wiring. See `guides/create-mixins.md`. |

Namespace CSS mixins are lightweight because every variant is just a `css()` object. No mixin handles, no lifecycle, no side effects. Use `createMixin()` only when you need attached behavior to DOM nodes.

---

## Adding a New Mixin Module

1. Create `ui/mixins/<name>.ts`
2. Import `{ css }` from `remix/ui` and `{ theme }` from `remix/ui/theme`
3. Define a namespace with a `base` entry plus variants
4. Export as `export const <name> = { base, variant1, ... }`

The `base` entry should contain shared properties (sizing, font, border). Variants add/override for specific appearances.

---

## 📂 Codebase References

- `remix/template/app/ui/mixins/` — Example namespace mixin modules
- Existing demos that use this pattern (search for `export const \w+ = {` in mixin files)

## Related

- `guides/css-mixins.md` — `css()` syntax and theme token usage
- `guides/create-mixins.md` — Lifecycle mixins for behavior (when NOT to use this pattern)
- `concepts/theme-contract.md` — `createTheme()` token contract
