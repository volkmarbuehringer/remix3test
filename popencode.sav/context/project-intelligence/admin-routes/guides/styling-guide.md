<!-- Context: project-intelligence/admin-routes/styling-guide | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Admin Styling Standards

**Purpose**: Admin-specific design tokens, `css()` mixins, and zebra striping patterns.

---

## Admin Design Tokens

Located in `bookstore/app/ui/tokens.ts` (legacy) / `remix/ui/theme` (current):

| Token | Value | Usage |
|-------|-------|-------|
| `adminAccent` | `#FF385C` | Primary admin buttons, focus rings |
| `adminAccentHover` | `#e62e4d` | Button hover states |
| `adminAccentLight` | `rgba(255, 56, 92, 0.1)` | Focus glow (`box-shadow`) |
| `zebraEven` | `theme.surface.lvl0` | Even table rows |
| `zebraOdd` | `theme.surface.lvl1` | Odd table rows |

> **Migration Note**: Admin pages now import `{ theme } from 'remix/ui/theme'` instead of `* as t from '../../ui/tokens.ts'`. See `../../development/remix3/lookup/token-migration.md` for the full mapping.

---

## Shared Admin Mixins

Located in `bookstore/app/controllers/admin/styles.ts`:

```typescript
import * as s from '../styles.ts'
```

| Mixin | Purpose |
|-------|---------|
| `pageTitleStyle` | H1 heading for admin pages |
| `pageDescriptionStyle` | Subtitle under page title |
| `filterContainerStyle` | Wrapper for filter form |
| `filterFormStyle` | Flex layout for search + select + button |
| `searchInputStyle` | Text input with admin accent focus |
| `selectInputStyle` | Dropdown with admin accent focus |
| `filterButtonStyle` | Admin accent submit button |
| `clearLinkStyle` | "Clear filters" reset link |
| `infoTextStyle` | "Showing X of Y" count text |
| `tableStyle` | Full-width zebra-striped table |
| `thCellStyle` | Table header cell |
| `thActionsStyle` | Fixed-width actions column (`120px`) |
| `actionButtonStyle` | Compact button for table actions |
| `inlineFormStyle` | Inline form for delete buttons |
| `emptyStateStyle` | Centered "No items found" text |

---

## Zebra Striping Pattern

All admin tables use alternating row colors via the global `tableStyle` mixin:

```css
& tbody tr:nth-child(even) { background-color: var(--rmx-surface-lvl0); }
& tbody tr:nth-child(odd)  { background-color: var(--rmx-surface-lvl1); }
```

**Theme equivalents** (in `app/controllers/admin/styles.ts`):

```typescript
export const zebraEvenStyle = css({ backgroundColor: theme.surface.lvl0 })
export const zebraOddStyle  = css({ backgroundColor: theme.surface.lvl1 })
```

No additional per-row styling is required — the table mixin handles it automatically.

---

## Focus States

Admin inputs use the `adminAccent` color for focus rings:

```typescript
'&:focus': {
  outline: 'none',
  borderColor: theme.colors.action.primary.background,
  boxShadow: `0 0 0 3px ${theme.colors.focus.ring}1a`,
}
```

This is applied consistently in `searchInputStyle` and `selectInputStyle` (see `app/controllers/admin/styles.ts`).

---

## Button Patterns

### Table Actions (Edit / Delete)

Uses mixins from `app/controllers/admin/styles.ts` (imported as `* as s`):

```typescript
<a mix={[s.buttonBaseStyle, s.buttonSecondaryStyle, s.actionButtonStyle]}>Edit</a>
<button mix={[s.buttonBaseStyle, s.buttonDangerStyle, s.actionButtonStyle]}>Delete</button>
```

### Primary Filter Button

```typescript
<button mix={s.filterButtonStyle}>Filter</button>
```

### Navigation Links

```typescript
<a mix={[s.buttonBaseStyle, s.buttonSecondaryStyle]}>Back to Dashboard</a>
```

---

## Related

- **CSS Mixins Guide**: `../../development/remix3/guides/css-mixins.md`
- **Shared Components**: `shared-components.md`
- **Theme Contract**: `../../development/remix3/concepts/theme-contract.md`
- **Token Migration**: `../../development/remix3/lookup/token-migration.md`
- **CSS Variable Reference**: `../../development/remix3/lookup/theme-contract-variables.md`
- **Theme Source**: `bookstore/app/ui/theme.tsx`
- **Styles Source**: `bookstore/app/controllers/admin/styles.ts`
