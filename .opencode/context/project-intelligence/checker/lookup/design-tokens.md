<!-- Context: checker/lookup/design-tokens | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Design Tokens

> Centralized design tokens module (`checker/app/ui/tokens.ts`) providing consistent colors, typography, spacing, and precomputed CSS mixins for Checker UI.

## Quick Reference

| Category | File | Usage |
|----------|------|-------|
| Import tokens | `import * as t from '../ui/tokens.ts'` | All token categories |
| Precomputed mixins | `t.buttonBase`, `t.inputBase`, etc. | Ready-to-use component styles |
| Genre colors | `t.genreColors[genre]` | Book genre badge styling |

## Token Categories

### Colors
```typescript
t.colors.primary      // '#0f172a'
t.colors.primaryLight // '#1e293b'
t.colors.secondary    // '#64748b'
t.colors.accent       // '#6366f1'
t.colors.accentHover  // '#4f46e5'
t.colors.danger / success / warning / info  // Semantic colors
t.colors.gray50–gray900  // Slate palette
```

### Typography
```typescript
t.fontSizes.xs       // 0.625rem  → t.fontSizes['6xl'] // 2rem
t.fontWeights.normal / medium / semibold / bold  // 400–700
```

### Spacing
```typescript
t.spacing[0]–t.spacing[12]  // 0 to 3rem, includes px and fractional steps
```

### Borders & Radii
```typescript
t.borders.none / sm / md / lg    // 0 to 4px
t.radii.none → full              // 0 to 9999px
```

### Shadows & Transitions
```typescript
t.shadows.none / sm / base / md / lg / xl
t.transitions.fast / base / slow / slower  // 0.1s–0.3s ease
```

## Precomputed CSS Mixins

```typescript
// Input components
<input mix={t.inputBase} />
<button mix={[t.buttonBase, t.buttonPrimary]}>Primary</button>
<div mix={t.cardBase}>Content</div>
<div mix={t.container}>...</div>
<a href="/..." mix={t.linkBase}>Link</a>
<span mix={t.badge}>Badge</span>
```

## Genre Colors

```typescript
t.genreColors.fiction.bg   // '#d1ecf1'
t.genreColors.fiction.text // '#0c5460'
// 19 genres total
```

## Migration Status

| File | Status |
|------|--------|
| `app/ui/layout.tsx` | ✅ Migrated |
| `app/controllers/auth/login/page.tsx` | ✅ Migrated |
| `app/controllers/chat/page.tsx` | ✅ Migrated |
| `app/controllers/admin/books/edit-page.tsx` | ✅ Migrated |

## Reference

- **Tokens module**: `checker/app/ui/tokens.ts`
- **Remix 3 CSS mixins**: `../../development/remix3/ui/guides/mixins.md`
- **Design system concept**: `../../development/remix3/concepts/design-system.md`
- **Migration guide**: Previously in this file; see `../../development/remix3/lookup/token-migration.md`
