<!-- Context: frame-navigation/lookup/refactoring-priority | Priority: medium | Version: 1.0 | Updated: 2026-03-25 -->

# Refactoring Priority Matrix

## Priority Matrix

| Priority | Pattern                         | Impact     | Effort | Status      |
| -------- | ------------------------------- | ---------- | ------ | ----------- |
| HIGH     | Admin page duplication          | -200 lines | Medium | Not started |
| HIGH     | Use Pagination component        | -120 lines | Low    | Not started |
| MEDIUM   | Complete editable field factory | -300 lines | Medium | Partial     |
| MEDIUM   | Generic CRUD controller         | -400 lines | Medium | Not started |
| LOW      | Form field generator            | -100 lines | High   | Not started |

## File Size Issues

| File               | Lines | Limit | Status  |
| ------------------ | ----- | ----- | ------- |
| `admin.css`        | 2224  | 2000  | ⚠️ Over |
| `courses-page.tsx` | 351   | 200   | ⚠️ Over |
| `index.tsx`        | 316   | 200   | ⚠️ Over |

## Recommendations

1. **Create `ResourceListPage` component** - Extract shared list page logic
2. **Complete editable field factory** - Migrate title-edit, type-edit, duration-edit
3. **Use existing components** - `<Pagination />`, `<EmptyState />`
4. **Build generic CRUD controller** - Consolidate controller-utils.ts patterns
5. **Split admin.css** - Move to layout + component files

## Reference

- `app/admin/admin-table.tsx` - ResourceListPage, Pagination
- `app/admin/index.tsx` - 316 lines (needs refactor)
- `app/assets/editable-field-factory.tsx` - Partial implementation
