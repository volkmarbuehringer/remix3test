# Example: Admin UI Migration

**Purpose**: Migrating admin routes from inline styles to design system CSS classes.

## Overview

7 admin routes migrated to use CSS class mappings for consistent UI.

## Routes Migrated

| Route               | File           | Classes Used                              |
| ------------------- | -------------- | ----------------------------------------- |
| `/admin`            | page.tsx       | .card, .btn                               |
| `/admin/books`      | index-page.tsx | .btn, .btn-secondary                      |
| `/admin/books/:id`  | form.tsx       | .btn, .btn-secondary, .card               |
| `/admin/users`      | index-page.tsx | .btn, .btn-secondary, .card               |
| `/admin/users/:id`  | form.tsx       | .btn, .btn-secondary, .card               |
| `/admin/orders`     | index-page.tsx | .btn, .btn-secondary, .btn-danger, .badge |
| `/admin/orders/:id` | show-page.tsx  | .btn-secondary, .card                     |

## Grid Components

`admin-books-grid.tsx` and `admin-users-grid.tsx` preserve inline editing while using CSS classes for buttons.

## Files Modified

All files in `demos/bookstore/app/controllers/admin/` and `demos/bookstore/app/assets/`

## Result

- Consistent button styles across all admin pages
- Zebra striping on tables
- Dark mode support
- No breaking changes to existing functionality

## Related

- remix3/guides/design-system-implementation.md
- remix3/examples/zebra-striping.md
