<!-- Context: development/remix3/lookup/token-migration | Priority: high | Version: 1.0 | Updated: 2026-04-28 -->

# Lookup: Token Migration Reference (tokens.ts → theme)

**Purpose**: Map old `app/ui/tokens.ts` exports to `remix/ui/theme` equivalents when converting `import * as t` → `import { theme }`.

---

## Color Mapping

```
t.colors.primary             → theme.colors.text.primary
t.colors.secondary           → theme.colors.text.secondary
t.colors.secondaryLight      → theme.colors.text.muted
t.colors.white/gray50        → theme.surface.lvl0/lvl1 (bg usage)
t.colors.gray100/200/300     → theme.surface.lvl2/lvl3/lvl4 (bg usage)
t.colors.gray100             → theme.colors.border.subtle
t.colors.gray200             → theme.colors.border.default
t.colors.accent              → theme.colors.action.primary.background
t.colors.accentHover         → theme.colors.action.primary.backgroundHover
t.colors.accentDark          → theme.colors.action.primary.backgroundActive
t.colors.danger/dangerHover  → theme.colors.action.danger.background/backgroundHover
```

## Spacing / Radius / Shadow

```
t.spacing[0]/px/0.5/1/2/4/8/12   → theme.space.none/px/xs/sm/md/lg/xl/xxl
t.radii.*                          → theme.radius.* (same keys)
t.shadows.sm/base/md/lg/xl        → theme.shadow.xs/sm/md/lg/xl (note offset)
```

## Typography

```
t.fontSizes.xs/sm/baseSm/base/md/lg/xl/'2xl'
  → theme.fontSize.xxxs/xxs/xs/sm/md/lg/xl/xxl (note shift)

t.fontWeights.*    → theme.fontWeight.* (same keys)
t.lineHeights.*    → theme.lineHeight.* (same keys)
```

## Mixin Migration Pattern

```typescript
// Before:
import * as t from '../../ui/tokens.ts'
let btn = css({ backgroundColor: t.colors.accent })

// After (define locally with theme):
import { theme } from 'remix/ui/theme'
let btn = css({ backgroundColor: theme.colors.action.primary.background })

// For shared mixins — add to app/controllers/admin/styles.ts:
export const buttonBaseStyle = css({ ... })     // Was: t.buttonBase
export const buttonSecondaryStyle = css({ ... }) // Was: t.buttonSecondary
export const buttonDangerStyle = css({ ... })    // Was: t.buttonDanger
export const zebraEvenStyle = css({ backgroundColor: theme.surface.lvl0 })
export const zebraOddStyle  = css({ backgroundColor: theme.surface.lvl1 })
```

## Inline Consolidation Pattern (added 2026-05-06)

When `tokens.ts` is only imported by `theme.tsx`, the raw values can be **inlined** directly into the `createTheme()` call. This removes an indirection layer and eliminates the risk of files accidentally importing from `tokens.ts` instead of `remix/ui/theme`.

```
Before: app/ui/tokens.ts → imported by app/ui/theme.tsx
After:  raw values live directly in app/ui/theme.tsx, tokens.ts deleted
```

**Before**:
```typescript
// app/ui/theme.tsx
import { createTheme } from 'remix/ui'
import { colors, space, radius } from './tokens.ts'
let Theme = createTheme({ colors, space, radius })
```

**After**:
```typescript
// app/ui/theme.tsx (tokens.ts values inlined)
import { createTheme } from 'remix/ui'
let Theme = createTheme({
  colors: { text: { primary: '#111827', secondary: '#374151' } },
  space: { none: '0px', px: '1px', xs: '2px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '24px' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
})
```

**When to inline**:
- ✅ `tokens.ts` imports are only from `theme.tsx`
- ✅ Token values are simple constants (not computed)
- ❌ Don't inline if tokens are shared with non-theme code

## 📂 Codebase References

**Source**: `bookstore/app/ui/tokens.ts` (old), `bookstore/app/ui/theme.tsx` (maps tokens→theme)

**Migrated pages** (using `import { theme } from 'remix/ui/theme'`):
- `app/controllers/admin/styles.ts` — All admin css() mixins
- `app/controllers/admin/chatlog/page.tsx`, `lists/index-page.tsx`, `orders/*.tsx`
- `app/ui/badge.tsx`, `admin-page-header.tsx`, `admin-table-card.tsx`

**Related**: Check `project-intelligence/admin-routes/` for admin migration guides
