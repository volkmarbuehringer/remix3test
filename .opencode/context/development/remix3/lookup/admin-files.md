<!-- Context: development/remix3/lookup/admin-files | Priority: medium | Version: 1.2 | Updated: 2026-04-18 -->

# Lookup: Admin Routes Files

**Purpose**: Quick reference to admin route files and their purposes

## Books Module (Checker)

| File                                                         | Purpose                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `checker/app/controllers/admin/books/controller.tsx` | CRUD actions including **edit/update/delete**, pagination, sorting, filtering |
| `checker/app/controllers/admin/books/page.tsx` | List view with **filters**, Edit/Delete buttons, sortable headers |
| `checker/app/controllers/admin/books/edit-page.tsx` | Edit form with backUrl support, inline delete |
| `checker/app/controllers/admin/books/show-page.tsx` | Detail view |
| `checker/app/controllers/admin/books/grid.tsx` | Table grid with Edit/Delete action links |

**Filters**: `q` (title, author), `genre` dropdown

**Routes**: `index`, `show`, `edit`, `update`, `delete`

## Books Module (Demo)

| File                                                         | Purpose                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `demos/bookstore/app/controllers/admin/books/controller.tsx` | CRUD actions, pagination, sorting, **filtering**, quick edit   |
| `demos/bookstore/app/controllers/admin/books/index-page.tsx` | List view with **filters**, Quick Edit modal, sortable headers |
| `demos/bookstore/app/controllers/admin/books/form.tsx`       | Create/edit form with backUrl support                          |
| `demos/bookstore/app/controllers/admin/books/show-page.tsx`  | Detail view                                                    |

**Filters**: `q` (title, author), `genre` dropdown

## Users Module

| File                                                         | Purpose                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `demos/bookstore/app/controllers/admin/users/controller.tsx` | CRUD actions, pagination, sorting, **filtering**                 |
| `demos/bookstore/app/controllers/admin/users/index-page.tsx` | List view with **filters**, sortable headers (name, email, role) |
| `demos/bookstore/app/controllers/admin/users/form.tsx`       | Create/edit form with backUrl                                    |

**Filters**: `q` (name, email), `role` dropdown (admin/customer)

## Orders Module (Read-Only)

| File                                                          | Purpose                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `demos/bookstore/app/controllers/admin/orders/controller.tsx` | Pagination, sorting, **filtering** (no create/edit/delete)                   |
| `demos/bookstore/app/controllers/admin/orders/index-page.tsx` | List view with **filters**, sortable headers (id, created_at, total, status) |
| `demos/bookstore/app/controllers/admin/orders/show-page.tsx`  | Detail view with backUrl                                                     |

**Filters**: `q` (order ID), `status` dropdown (pending/processing/shipped/delivered)

## Shared

| File                                                                    | Purpose                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `demos/bookstore/app/controllers/admin/utils.ts`                        | parsePage, parseSort, getPaginationInfo, **FilterState** type |
| `demos/bookstore/app/controllers/admin/components/quick-edit-modal.tsx` | Reusable quick edit modal component                           |
| `demos/bookstore/app/utils/toast.ts`                                    | createToastResponse, getToastFromSession                      |

## Related

- guides/admin-utils.md
- guides/filtering.md
- concepts/toast-system.md
