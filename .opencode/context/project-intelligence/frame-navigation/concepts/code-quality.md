<!-- Context: frame-navigation/concepts/code-quality | Priority: medium | Version: 1.0 | Updated: 2026-03-25 -->

# Code Quality Insights

## Strengths

1. **Consistent component pattern** - All pages use curried function pattern
2. **Toast pattern** - Centralized via `showToast()` in `app/lib/toast-utils.ts`
3. **CSS variables** - Good use of design tokens with dark mode support
4. **Client components** - Clean separation with `clientEntry()`

## Concerns

1. **Controller duplication** - 75-85% similar code across split controllers
2. **Page duplication** - 70% similar structure in admin list pages
3. **Unused components** - `Pagination` in `admin-table.tsx` not used
4. **Inline SVGs** - Users page has 30 lines of inline SVG

## Patterns Verified

| Pattern             | Location                      | Status                 |
| ------------------- | ----------------------------- | ---------------------- |
| Split controllers   | `app/admin/*-controller.tsx`  | ✅ Consistent          |
| buildCRUDActions    | `app/lib/controller-utils.ts` | ✅ 2/3 controllers use |
| ResourceListPage    | `app/admin/admin-table.tsx`   | ⚠️ Exists, unused      |
| Event delegation    | `app/assets/editable-*.tsx`   | ✅ Working             |
| Toast notifications | `app/lib/toast-utils.ts`      | ✅ Single source       |

## Code Statistics

- **Total TypeScript files**: 47
- **Curried components**: 18 (95% consistent)
- **Split controllers**: 4 (3 use buildCRUDActions)
- **Client entry components**: 6
