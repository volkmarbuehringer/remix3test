<!-- Context: development/remix3/guides/data-route-checklist | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Data Route Checklist

Implementation checklist for data routes with CRUD operations.

## Route Setup

- [ ] Route defined in `app/routes.ts` with nested structure
- [ ] All CRUD actions implemented (index, show, new, create, edit, update, destroy)

## Index Action

- [ ] Pagination with `PAGE_SIZE` constant
- [ ] `page` param parsed with `Math.max(1, ...)`
- [ ] `toast` and `toastError` parsed from URL
- [ ] Empty state shown when no data
- [ ] Breadcrumbs included

## Create/Update Actions

- [ ] Form data parsed from `request.formData()`
- [ ] Validation errors caught with `DATA_TABLE_VALIDATION_ERROR`
- [ ] Validation errors redirect to form with `toastError`
- [ ] Success redirects to list with `toast`
- [ ] Page preserved in redirects

## Delete Action

- [ ] Foreign key errors handled gracefully
- [ ] User-friendly error message on failure
- [ ] Page preserved in redirect

## Component Dependencies

| Component   | File                         | Purpose         |
| ----------- | ---------------------------- | --------------- |
| Breadcrumbs | `components/breadcrumbs.tsx` | Navigation      |
| Pagination  | `components/pagination.tsx`  | Page navigation |
| FormField   | `components/form-field.tsx`  | Field wrapper   |
| Toast       | `components/toast.tsx`       | Notifications   |

## Related

- `examples/editable-fields.md` - Inline editing pattern
- `guides/pagination.md` - Pagination implementation
- `guides/admin-utils.md` - Error handling utilities
