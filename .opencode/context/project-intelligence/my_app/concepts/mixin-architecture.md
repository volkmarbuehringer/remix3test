<!-- Context: project-intelligence/my_app/mixin-architecture | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Mixin Architecture

**Core Idea**: Reusable `css()` mixins composed from `remix/ui/theme` tokens, organized by element type in `app/ui/mixins/`. 14 mixins across 4 files provide a single source of truth for common visual patterns.

---

## File Structure

```
app/ui/mixins/
├── button.ts    # buttonBase, buttonPrimary, buttonGhost, buttonDanger
├── card.ts      # cardBase, cardHover, cardSelected
├── input.ts     # inputBase, inputFocus, inputError
├── text.ts      # textHeading, textBody, textMuted, textLabel
```

---

## Import Pattern

```typescript
// From within app/ui/ (e.g., layout.tsx)
import { textMuted } from './mixins/text.ts'

// From within app/actions/
import { cardBase } from '../../ui/mixins/card.ts'
```

All mixins are **named exports** — import only what you need.

---

## Composition

Mixins compose with `css({...})` and `theme.*` tokens:
- Alone: `<p mix={textMuted}>...</p>`
- Arrays: `<div mix={[cardBase, cardHover]}>...</div>`
- With Button: `<Button tone="ghost" mix={navButtonStyle}>...</Button>`

---

## Theme Contract Naming Conventions

Action color properties use **foreground** (not `text`) and **backgroundHover** (not `hover`):

| When you want... | Use this token |
|-----------------|----------------|
| Action text color | `theme.colors.action.primary.foreground` |
| Action hover bg | `theme.colors.action.primary.backgroundHover` |
| Danger text color | `theme.colors.action.danger.foreground` |
| Danger hover bg | `theme.colors.action.danger.backgroundHover` |
| Regular text | `theme.colors.text.primary` / `.secondary` / `.muted` |
| Regular bg | `theme.surface.lvl0` through `lvl4` |

**Gotcha**: `theme.colors.action.primary.text` or `.hover` don't exist.

---

## Adopted In

`textMuted` used in `layout.tsx` footer:

```typescript
import { textMuted } from './mixins/text.ts'
// ...
<footer mix={footerStyle}>
  <p mix={textMuted}>© {new Date().getFullYear()} My App</p>
</footer>
```

---

## Theme Source Consolidation (added 2026-05-06)

During the `layout.tsx` migration, `tokens.ts` was inlined into `theme.tsx` — raw values now feed directly into `createTheme()` instead of passing through an intermediate file:

```typescript
// theme.tsx — tokens.ts contents inlined
let Theme = createTheme({
  space: { none: '0', px: '1px', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '24px' },
  // ...
})
```

**Why**: Removes indirection and eliminates the risk of other files importing from `tokens.ts` instead of `remix/ui/theme`. The `tokens.ts` file can be deleted once all consumers are migrated.

## Provenance

Established during archived change `adopt-remix-ui-patterns`:
- Archive: `openspec/changes/archive/2026-05-05-adopt-remix-ui-patterns/`
- Scope: 14 mixins across 4 files
- All 88 tests pass, 0 typecheck errors

---

## 📂 Codebase References

- Mixin library: `my_app/app/ui/mixins/button.ts`, `card.ts`, `input.ts`, `text.ts`
- Layout usage: `my_app/app/ui/layout.tsx` (footer)
- Theme source: `remix/ui/theme`

## Related

- `../guides/css-mixin-usage.md` — How-to guide for creating and composing mixins
- `../guides/ui-component-patterns.md` — Full UI component inventory
- `../concepts/button-tone-convention.md` — Button `tone` prop (separate from mixins)
- `development/remix3/ui/concepts/theme-contract.md` — Theme contract API
