<!-- Context: project-intelligence/my_app/guides/css-mixin-usage | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# How-To: CSS Mixin Usage

**Purpose**: Create and use reusable `css()` mixins composed from `remix/ui/theme` tokens. The mixin library is at `app/ui/mixins/` with 14 mixins organized by element type.

---

## Step 1: Choose the Right Category

| Category | File | Mixins | Use For |
|----------|------|--------|---------|
| **Button** | `mixins/button.ts` | `buttonBase`, `buttonPrimary`, `buttonGhost`, `buttonDanger` | Custom buttons outside `Button` primitive, or as base for Button `mix` prop |
| **Card** | `mixins/card.ts` | `cardBase`, `cardHover`, `cardSelected` | Container panels, list items, selected states |
| **Input** | `mixins/input.ts` | `inputBase`, `inputFocus`, `inputError` | Form inputs, textareas |
| **Text** | `mixins/text.ts` | `textHeading`, `textBody`, `textMuted`, `textLabel` | Typography convention |

---

## Step 2: Import and Use

```typescript
import { textMuted } from './mixins/text.ts'
import { cardBase, cardHover } from './mixins/card.ts'

// Single mixin
<p mix={textMuted}>Footer text</p>

// Composed mixins (array — last matching property wins)
<div mix={[cardBase, cardHover]}>Hoverable card</div>
```

---

## Step 3: Creating a New Mixin

Every mixin follows the same pattern:

```typescript
// app/ui/mixins/card.ts
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const cardBase = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  padding: theme.space.lg,
})
```

**Rules**:
1. Always import `css` from `remix/ui` and `theme` from `remix/ui/theme`
2. Export named constants (not default)
3. One file per element type — never mix button and card mixins in the same file
4. Use `theme.*` tokens for all color/spacing/typography values — no `var(--*)`
5. Action colors use `foreground` not `text`, `backgroundHover` not `hover`

---

## Step 4: Theme Contract Action Color Properties

When styling action elements (buttons, links, etc.):

```typescript
// ✅ Correct: foreground + backgroundHover
const btn = css({
  color: theme.colors.action.primary.foreground,
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
})

// ❌ Wrong: these properties don't exist
const btn = css({
  color: theme.colors.action.primary.text,        // ❌
  '&:hover': { background: theme.colors.action.primary.hover }, // ❌
})
```

**Full action color path reference**:

| Path | Meaning |
|------|---------|
| `theme.colors.action.primary.background` | Primary button/link bg |
| `theme.colors.action.primary.foreground` | Primary button/link text color |
| `theme.colors.action.primary.backgroundHover` | Primary hover state bg |
| `theme.colors.action.primary.backgroundActive` | Primary pressed/active state bg |
| `theme.colors.action.danger.background` | Danger button bg |
| `theme.colors.action.danger.foreground` | Danger button text |
| `theme.colors.action.danger.backgroundHover` | Danger hover state bg |

---

## Step 5: Mixin + Button `tone` Composition

The mixin library provides raw `css()` blocks. For button styling, prefer `<Button tone="...">` from `remix/ui/button` (see `button-tone-convention.md`). The `buttonPrimary`/`buttonGhost`/`buttonDanger` mixins serve as reference for what tones produce, not as replacements.

When a Button needs *additional* styling on top of its tone, use the `mix` prop:

```tsx
<Button tone="ghost" mix={customNavStyle}>Logout</Button>
```

---

## Step 6: Adopting a Mixin (Migrating from Inline Styles)

```typescript
// Before: inline css() in component file
const footerStyle = css({
  color: 'var(--text-muted, #94a3b8)',
  fontSize: theme.fontSize.xs,
})

// After: import from mixins library
import { textMuted } from './mixins/text.ts'
<p mix={textMuted}>Footer text</p>
```

The `textMuted` mixin was adopted in `layout.tsx` footer as a demonstration during the `adopt-remix-ui-patterns` change.

---

## What NOT to Do

- ❌ Don't mix element types in one file (e.g., button mixins in `text.ts`)
- ❌ Don't use `var(--*)` in mixins — use `theme.*` tokens
- ❌ Don't export `default` — use named exports
- ❌ Don't import mixins from `remix/ui/button` for visual-only styles — that package provides the `<Button>` component, not css() blocks

---

## 📂 Codebase References

- Mixin library: `my_app/app/ui/mixins/button.ts`, `card.ts`, `input.ts`, `text.ts`
- Layout adoption: `my_app/app/ui/layout.tsx` (line 186 — `textMuted` in footer)
- Theme contract: `remix/ui/theme`

---

## Common Pitfall: `var()` Without Fallback Is Valid When Variable Is Always Defined (added 2026-05-06)

When using the **bridge pattern** — CSS variables defined at a container level via `theme.*` tokens, then referenced via `var()` in child `css()` blocks — no fallback value is needed because the variable is guaranteed to be defined:

```typescript
// Container defines CSS vars from theme.* tokens
const pageStyles = css({
  '--bg-primary': theme.surface.lvl0,
  '--border-color': theme.colors.border.default,
})

// Child references via var() — no fallback necessary
const cardStyle = css({
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
})
```

**Why this works**: The custom property values are sourced from `theme.*`, so they update correctly in dark mode. The variable is always defined by the parent `css()` block, so no fallback is required.

**For dynamic per-instance values** (e.g., prompt-button colors by type), use inline `style` to set the variable, then `var()` in `css()`:

```typescript
// Container sets variable dynamically via inline style
<button
  mix={[css({ background: 'var(--btn-bg)' })]}
  style={{ '--btn-bg': tone === 'success' ? theme.colors.action.success.background : theme.colors.action.danger.background }}
>Submit</button>
```

The variable is always defined via the inline `style` prop, so no fallback is needed. This is the pattern used by the prompt-button component.

**🚫 Wrong reason to avoid this**: "var() might be undefined at runtime." If the container or inline `style` controls the variable, it's always defined.
**✅ Right reason to prefer direct `theme.*`**: Less indirection — fewer tokens to keep in sync across bridge variables.

---

## Related

- `../concepts/mixin-architecture.md` — Architecture overview and composition rules
- `../concepts/button-tone-convention.md` — Button `tone` prop convention
- `development/remix3/ui/concepts/theme-contract.md` — Theme contract API
- `development/remix3/lookup/token-migration.md` — Old tokens → theme migration
