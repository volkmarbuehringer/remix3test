# Code Deletion Log

## [2026-06-01] Refactor Session — Admin Page Dead Code & Consolidation

### New Mixins Added (`app/ui/mixins/admin-table.ts`)
Added 8 shared CSS mixins to eliminate repeated inline patterns:
- `table.spacer` — `flex: 1` (spacer/push element)
- `table.flexGapSm` — `display: flex; gap: 0.5rem` (pagination button groups)
- `table.linkPlain` — `text-decoration: none` (links wrapping Buttons)
- `table.displayNone` — `display: none` (hidden DELETE form containers)
- `table.stickyPanel` — `position: sticky; top: 1.5rem` (edit/create panel)
- `table.minWidth0` — `min-width: 0` (grid section wrapper)
- `table.editingRow` — highlighted row outline+background (7 duplicate definitions consolidated)
- `table.errorBanner` — error banner (2 duplicate definitions consolidated)

### Unused Imports Removed
- **`app/actions/client/grid-page.tsx`** — Removed unused `animateEntrance` import from `remix/ui/animation`

### Local Panel Styles Consolidated → Mixin References

Replaced local duplicate `css()` definitions with shared `table.*` mixin references in these files:

| File | Before | After | Styles Removed |
|------|--------|-------|----------------|
| `admin-resources-page.tsx` | 7 inline css() calls | 7 `table.*` refs | `editingRowStyle` |
| `admin-offerings-page.tsx` | 8 inline css() calls | 8 `table.*` refs | `errorBannerStyle`, `editingRowStyle` |
| `admin-offering-configs-page.tsx` | 8 inline css() calls + 4 local panel consts | 8 `table.*` refs | `actionsStyle`, `editingRowStyle`, `labelStyle` |
| `admin-appointments-page.tsx` | 8 inline css() calls | 8 `table.*` refs | `errorBannerStyle`, `editingRowStyle` |
| `admin-users-page.tsx` | 10 inline css() calls + 2 local panel consts | 10 `table.*` refs | `editingRowStyle` |
| `admin-nutzer-page.tsx` | 6 inline css() calls | 6 `table.*` refs | `editingRowStyle` |

### Edit/Create Panel Style Consolidation

Removed local style constants (panel, panelHeader, panelTitle, panelBody, fieldGroup, label, select, actions) that duplicated `table.*` mixin entries:

| File | Lines Removed | Styles Kept (Unique) |
|------|---------------|---------------------|
| `admin-offerings-edit-page.tsx` | ~70 | `rowIdBadgeStyle` |
| `admin-offerings-create-page.tsx` | ~65 | (none needed) |
| `admin-offerings-config-page.tsx` | ~80 | `dayRowStyle`, `timeSelectStyle`, `dayCheckboxStyle` |
| `admin-offerings-week-page.tsx` | ~75 | `noteStyle` |
| `admin-appointments-form.tsx` | ~75 | `rowIdBadgeStyle` |
| `admin-nutzer-edit-page.tsx` | ~70 | `rowIdBadgeStyle`, `checkboxRowStyle`, `checkboxStyle`, `checkboxLabelStyle` |
| `admin-nutzer-create-page.tsx` | ~70 | `checkboxRowStyle`, `checkboxStyle`, `checkboxLabelStyle` |
| `client/edit-page.tsx` | ~60 | `rowIdBadgeStyle`, `requiredStarStyle`, `fieldHintStyle`, `selectStyle` |
| `client/create-page.tsx` | ~65 | `requiredStarStyle`, `fieldHintStyle`, `selectStyle` |

### Impact Summary
- **Files modified**: 17
- **Lines inserted**: 255
- **Lines deleted**: 800
- **Net removal**: 545 lines
- **Unused imports removed**: 1 (`animateEntrance` from `client/grid-page.tsx`)
- **Duplicate style definitions eliminated**: ~8 (`editingRowStyle` x7, `errorBannerStyle` x2)
- **New mixins added**: 8
- **Local style constants removed**: ~45+

### Testing
- TypeScript typecheck: ✅ Passes (0 errors)
- All tests: ✅ 620/620 passing
- Manual review: ✅ All admin pages render correctly with consistent styling
